/**
 * Knockout bootstrap pageable and sortable data table
 * https://github.com/slowkot/knockout-bootstrap-sortable-data-table
 */

;(function () {
    'use strict';
    var proto = {},
        sorter = function(prop, direction) {
            var sortBy = typeof prop === 'function'
                             ? prop
                             : prop != null
                             ? function(item) { return item[prop]; }
                             : function(item) { return item; },
                compare = function(a, b) {
                    a = sortBy(a);
                    b = sortBy(b);
                    return a < b ? -1 : (a > b ? 1 : 0);
                };

            return direction === 'desc'
                       ? function(a, b) { return compare(b, a); }
                       : compare;
        },
        extend = function() {
            var args = arguments;
            return Array.prototype.reduce.call(args, ko.utils.extend);
        },
        isString = function(value) {
            return typeof value === 'string' || value instanceof String;
        };

    var defaultSettings = {
        columns: [],
        sortable: false,
        throttle: 100,
        compareBy: 'id',
        comparator: null,
        page: {
            sizes: [10, 25, 50, 100],
            size: null,
            index: 0,
            radius: 2
        },
        css: {
            sort: { '': '', 'asc': 'dt-sort-down', 'desc': 'dt-sort-up' }
        }
    };

    function TableColumn(column) {
        var stringValue = isString(column.value) ? column.value : '';

        this.name = column.name || stringValue;
        this.value = column.value;
        this.template = column.template;
        this.html = column.html;
        this.sortable = column.sortable;
        this.sortBy = column.sortBy || column.value || null;
        this.width = column.width;
        this.cssClass = ko.observable('');
    }

    function Page(page) {

        this.sizes = ko.observable(page.sizes || []);
        this.sizes.selected = ko.observable(page.size && (!this.sizes().length || this.sizes().indexOf(page.size) >= 0) ? page.size : this.sizes()[0] || 0);


        this.index = ko.observable(page.index || 0);
        this.count = ko.observable(0);
        this.radius = ko.observable(page.radius || 2);


        this.pages = ko.computed(function () {
            var pages = [],
                pageCount = this.count(),
                activePage = this.index() + 1,
                radius = this.radius(),
                page, elem, last;
            for (page = 1; page <= pageCount; page++) {
                if (page == 1 || page == pageCount) {
                    elem = page;
                } else if (activePage < 2 * radius + 1) {
                    elem = (page <= 2 * radius + 1) ? page : 'ellipsis';
                } else if (activePage > pageCount - 2 * radius) {
                    elem = (pageCount - 2 * radius <= page) ? page : 'ellipsis';
                } else {
                    elem = (Math.abs(activePage - page) <= radius ? page : 'ellipsis');
                }
                if (elem != 'ellipsis' || last != 'ellipsis') {
                    pages.push(elem);
                }
                last = elem;
            }
            return pages;
        }, this);

        this.isFirst = ko.computed(function () { return this.index() === 0 }, this);
        this.isLast = ko.computed(function () { return this.index() === this.count() - 1 }, this);

        this.sizes.selected.subscribe(this.index.bind(this, 0));


        ['prev', 'next', 'move'].forEach(function(key) {
            this[key] = this[key].bind(this);
        }, this);
    }

    extend(Page.prototype, {
        prev: function() {
            var index = this.index();
            if (index > 0) {
                this.index(index - 1);
            }
        },

        next: function() {
            var index = this.index();
            if (index < this.count() - 1) {
                this.index(index + 1);
            }
        },

        move: function(index) {
            this.index(index - 1);
        }
    });

    function DataTable(settings) {
        this._settings = extend({}, defaultSettings, settings);

        var columns = this._settings.columns;
        columns = columns && isString(columns) ? columns.split(',') : Array.isArray(columns) ? columns : [];

        this.loader = settings.loader || this._staticLoader;

        this.items = ko.observableArray(ko.unwrap(this._settings.items) || []);
        this.items.selected = ko.observable();
        this.columns = columns.map(this._createColumnDefenition, this);
        this.columns.htmlTemplate = ko.utils.parseHtmlFragment('<div data-bind="html: $data"></div>');
        this.sorting = { sortColumn: null, sortOrder: '' };
        this.comparator = settings.comparator || this._defaultComparator;

        this.page = new Page(extend({}, defaultSettings.page, this._settings.page));

        
        
        this.initialize();
    }

    extend(DataTable.prototype, proto = {
        initialize: function() {
            ko.computed(this.reload, this).extend({ throttle: this._settings.throttle });

            this.cssMap = defaultSettings.css.sort;

            for (var m in proto) {
                if (proto.hasOwnProperty(m)) {
                    this[m] = this[m].bind(this);
                }
            }
            this.reload();
        },

        reload: function(preserveSelection) {
            this._preserveSelection = preserveSelection || null;
            this.loader({
                pageIndex: this.page.index() + 1,
                pageSize: this.page.sizes.selected(),
                sortBy: (this.sorting.sortColumn ? this.sorting.sortColumn.sortBy : ''),
                sortDirection: this.sorting.sortOrder
            },
            this._reloadCallback.bind(this),
            this._totalCallback.bind(this));
        },

        restoreSelection: function () {
            var selection = this.items.selected(),
                items = this.items(),
                newSelection = null;
            if (selection) {
                for (var i = 0; i < items.length; i++) {
                    if (this.comparator(items[i], selection)) {
                        newSelection = items[i];
                        break;
                    }
                }
            }
            this.selectItem(newSelection);
        },

        selectItem: function selectItem(item) {
            this.items.selected(item);
            if (this._settings.selectItem) {
                this._settings.selectItem(item);
            }
            return true;
        },

        sort: function (column) {
            if (this.sorting.sortColumn && this.sorting.sortColumn != column) this.sorting.sortColumn.cssClass('');
            this.sorting.sortColumn = column;
            this.sorting.sortOrder = this.sorting.sortOrder == '' ? 'asc' : (this.sorting.sortOrder == 'desc' ? 'asc' : 'desc');
            column.cssClass(this.cssMap[this.sorting.sortOrder]);
            this.reload();
        },

        toArray: function (target, values) {
            if (Array.isArray(target)) {
                return  values !== 'key' ? target : target.map(function(x, i) { return i + 1; });
            }

            var data = ko.unwrap(target || {}),
                dataArr = [],
                map = values === 'value'
                          ? function(key, value) { dataArr.push(value); }
                          : values === 'key'
                              ? function(key) { dataArr.push(key); }
                              : function(key, value) { dataArr.push([key, value]); };
            for (var prop in data) {
                if (data.hasOwnProperty(prop) && (data[prop] || data[prop] === false || data[prop] === 0)) {
                    map(prop, data[prop]);
                }
            }
            return dataArr;
        },

        _staticLoader: function (options, callback, totalCallback) {
            var items = this._settings.items.slice();
            options.sortBy && items.sort(sorter(options.sortBy, options.sortDirection));
            callback(options.pageSize ? items.slice(options.pageSize * (options.pageIndex - 1), options.pageSize * options.pageIndex) : items);
            totalCallback(items.length);
        },

        _reloadCallback: function (data) {
            this.items(data);
            if (this._preserveSelection === true) {
                this.restoreSelection();
            }
            //this.pageIndex(Math.min(data.number, data.totalPages - 1) || 1);
            //this.totalPages(data.totalPages || 0);
            //this.pageSize(data.size || 2);
        },

        _totalCallback: function(total) {
            this.page.sizes.selected() && this.page.count(Math.ceil(total / this.page.sizes.selected()));
        },

        _defaultComparator: function (a, b) {
            return a && b && a.id && b.id ? a[this._settings.compareBy] === b[this._settings.compareBy] : a === b;
        },

        _createColumnDefenition: function (column) {
            column = isString(column) ? { value: column.trim() } : column;
            column.sortable = column.sortable != null ? column.sortable : this._settings.sortable;
            return new TableColumn(column);
        }
    });

    ko.dataTable = {
        ViewModel: DataTable
    };

    var templateEngine = new ko.nativeTemplateEngine();

    document.getElementsByTagName('head')[0].appendChild(ko.utils.parseHtmlFragment('<style type="text/css">\
            .dt-header:after {content: "";float: right;margin-top: 7px;visibility: hidden;}\
            .dt-sort-down:after {border-width: 0 4px 4px;border-style: solid;border-color: #000 transparent;visibility: visible;}\
            .dt-sort-up:after {border-bottom: none;border-left: 4px solid transparent;border-right: 4px solid transparent;border-top: 4px solid #000;visibility: visible;}\
            .dt-selected {background-color: #f5f5f5}\
        </style>')[0]);

    templateEngine.addTemplate = function (templateName, templateMarkup) {
        document.write('<script type="text/html" id="' + templateName + '">' + templateMarkup + '<' + '/script>');
    };

    templateEngine.addTemplate('ko_table_header', '\
                        <thead>\
                            <tr data-bind="foreach: columns">\
                               <!-- ko if: $data.sortable -->\
                                   <th class="dt-header" data-bind="text: name, css: cssClass, style: { width: width }, click: $root.sort"></th>\
                               <!-- /ko -->\
                               <!-- ko ifnot: $data.sortable -->\
                                   <th class="dt-header" data-bind="text: name, css: cssClass, style: { width: width }"></th>\
                               <!-- /ko -->\
                            </tr>\
                        </thead>');

    templateEngine.addTemplate('ko_table_body', '\
                        <tbody data-bind="foreach: items">\
                            <tr data-bind="click: $root.selectItem, css: {dt-selected : $root.comparator($root.items.selected(), $data)}">\
                                <!-- ko foreach: $parent.columns -->\
                                    <!-- ko if: template -->\
                                        <td data-bind="template: { name: template, data: typeof value == \'function\' ? value($parent) : $parent[value] }"></td>\
                                    <!-- /ko -->\
                                    <!-- ko ifnot: template -->\
                                        <td data-bind="text: typeof value == \'function\' ? value($parent) : $parent[value] "></td>\
                                    <!-- /ko -->\
                                <!-- /ko -->\
                            </tr>\
                        </tbody>');

    templateEngine.addTemplate('ko_table_pager', '\
        <tfoot>\
        <tr>\
        <td data-bind="attr: {colspan: columns.length}">\
            <div data-bind="foreach: [10, 25, 50, 100]">\
                <!-- ko if: $data == $root.pageSize() -->\
                    <span data-bind="text: $data + \' \'"/>\
                <!-- /ko -->\
                <!-- ko if: $data != $root.pageSize() -->\
                    <a href="#" data-bind="text: $data + \' \', click: function() { $root.pageSize($data) }"/>\
                <!-- /ko -->\
            </div>\
            <div class="pagination" data-bind="if: totalPages() > 1">\
                <ul>\
                    <li data-bind="css: { disabled: isFirstPage() }">\
                        <a href="#" data-bind="click: prevPage">«</a>\
                    </li>\
                    <!-- ko foreach: pages() -->\
                        <!-- ko if: $data == "ellipsis" -->\
                            <li>\
                                <span>...</span>\
                            </li>\
                        <!-- /ko -->\
                        <!-- ko if: $data != "ellipsis" -->\
                            <li data-bind="css: { active: $data === ($root.pageIndex() + 1)}">\
                                <a href="#" data-bind="text: $data, click: $root.moveToPage"/>\
                            </li>\
                        <!-- /ko -->\
                    <!-- /ko -->\
                    <li data-bind="css: { disabled: isLastPage() }">\
                        <a href="#" data-bind="click: nextPage">»</a>\
                    </li>\
                </ul>\
            </div>\
        </td>\
        </tr>\
    </tfoot>');

    ko.bindingHandlers.dataTable = {
        init: function (element, valueAccessor, allBindingsAccessor) {
            var viewModel = valueAccessor(), allBindings = allBindingsAccessor();

            var tableHeaderTemplateName = allBindings.dtHeaderTemplate || 'ko_table_header',
                tableBodyTemplateName = allBindings.dtBodyTemplate || 'ko_table_body',
                tablePagerTemplateName = allBindings.dtFooterTemplate || 'ko_table_pager';

            ko.utils.emptyDomNode(element);

            var table = element;

            if (!(viewModel instanceof ko.dataTable.ViewModel)) {
                viewModel = new ko.dataTable.ViewModel(Array.isArray(ko.unwrap(viewModel)) ? { items: viewModel } : viewModel);
            }

            // Render table header
            var headerContainer = table.appendChild(document.createElement('DIV'));
            ko.renderTemplate(tableHeaderTemplateName, viewModel, { templateEngine: templateEngine }, headerContainer, 'replaceNode');

            // Render table body
            var bodyContainer = table.appendChild(document.createElement('DIV'));
            ko.renderTemplate(tableBodyTemplateName, viewModel, { templateEngine: templateEngine }, bodyContainer, 'replaceNode');

            // Render table pager
            var pagerContainer = table.appendChild(document.createElement('DIV'));
            ko.renderTemplate(tablePagerTemplateName, viewModel, { templateEngine: templateEngine }, pagerContainer, 'replaceNode');
            return { 'controlsDescendantBindings': true };
        },
        update: function (element, valueAccessor, allBindingsAccessor) {
            //var context = ko.contextFor(element),
            //    viewModel = ko.unwrap(valueAccessor());
            //if (Array.isArray(viewModel)) {
            //    context.items(viewModel);
            //}
            
        }
    };
})();
