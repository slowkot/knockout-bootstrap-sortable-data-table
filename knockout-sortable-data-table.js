/**
 * Knockout bootstrap pageable and sortable data table
 * https://github.com/slowkot/knockout-bootstrap-sortable-data-table
 */

;(function () {
    'use strict';
    var proto = {};

    function TableColumn(column) {

        this.name = column.name || '';
        this.value = column.value;
        this.template = column.template;
        this.sortable = column.sortable;
        this.sortField = column.sortField;
        this.width = column.width;
        this.cssClass = ko.observable('');
    }

    function DataTable(config) {
        this.config = config;
        this.sortable = config.sortable || false;
        this.throttle = config.throttle || 100;
        this.loader = config.loader;
        this.selectedItem = ko.observableArray();
        this.items = ko.observableArray(config.items || []);
        this.columns = [];
        for (var i = 0; i < config.columns.length; i++) {
            var column = config.columns[i];
            column.sortable = column.sortable || this.sortable;
            this.columns.push(new TableColumn(column));
        }
        this.sorting = { sortColumn: null, sortOrder: '' };
        this.comparator = config.comparator || function (a, b) {
            return a && b && a.id && b.id ? a.id === b.id : a === b;
        };
        this.totalPages = ko.observable();
        this.pageIndex = ko.observable(0);
        this.pageSize = ko.observable(config.pageSize || 10);
        this.pageRadius = ko.observable(config.pageRadius || 2);
        this.isFirstPage = ko.computed(function () { return this.pageIndex() === 0 }, this);
        this.isLastPage = ko.computed(function () { return this.pageIndex() === this.totalPages() - 1 }, this);
        this.pages = ko.computed(function () {
            var pages = [];
            var page, elem, last;
            for (page = 1; page <= this.totalPages() ; page++) {
                var activePage = this.pageIndex() + 1;
                var totalPage = this.totalPages();
                var radius = this.pageRadius();
                if (page == 1 || page == totalPage) {
                    elem = page;
                } else if (activePage < 2 * radius + 1) {
                    elem = (page <= 2 * radius + 1) ? page : 'ellipsis';
                } else if (activePage > totalPage - 2 * radius) {
                    elem = (totalPage - 2 * radius <= page) ? page : 'ellipsis';
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

        this.content = ko.computed(this.reload, this).extend({ throttle: this.throttle });

        this.cssMap = { '': '', 'asc': 'sortDown', 'desc': 'sortUp' };

        for (var m in proto) {
            if (proto.hasOwnProperty(m)) {
                this[m] = this[m].bind(this);
            }
        }
    }

    $.extend(DataTable.prototype, proto = {

        prevPage: function () {
            if (this.pageIndex() > 0) {
                this.pageIndex(this.pageIndex() - 1);
            }
        },

        nextPage: function () {
            if (this.pageIndex() < this.totalPages() - 1) {
                this.pageIndex(this.pageIndex() + 1);
            }
        },

        moveToPage: function (index) {
            this.pageIndex(index - 1);
        },

        reload: function (preserveSelection) {
            this._preserveSelection = preserveSelection || null;
            this.loader(
                this.pageIndex() + 1,
                this.pageSize(),
                (this.sorting.sortColumn ? this.sorting.sortColumn.sortField : ''),
                this.sorting.sortOrder,
                this._reloadCallback.bind(this));
        },

        restoreSelection: function () {
            var selection = this.selectedItem(), items = this.items(), newSelection = null;
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
            this.selectedItem(item);
            if (this.config.selectItem) {
                this.config.selectItem(item);
            }
        },

        sort: function (column) {
            if (this.sorting.sortColumn && this.sorting.sortColumn != column) this.sorting.sortColumn.cssClass('');
            this.sorting.sortColumn = column;
            this.sorting.sortOrder = this.sorting.sortOrder == '' ? 'asc' : (this.sorting.sortOrder == 'desc' ? 'asc' : 'desc');
            column.cssClass(this.cssMap[this.sorting.sortOrder]);
            this.reload();
        },

        _reloadCallback: function (data) {
            this.items(data.content);
            if (this._preserveSelection === true) {
                this.restoreSelection();
            }
            this.pageIndex(Math.min(data.number, data.totalPages - 1));
            this.totalPages(data.totalPages);
            this.pageSize(data.size);
        }
    });

    ko.dataTable = {
        ViewModel: DataTable
    };

    var templateEngine = new ko.nativeTemplateEngine();

    $('head').append('<style type="text/css">\
        .header:after {content: "";float: right;margin-top: 7px;visibility: hidden;}\
        .sortDown:after {border-width: 0 4px 4px;border-style: solid;border-color: #000 transparent;visibility: visible;}\
        .sortUp:after {border-bottom: none;border-left: 4px solid transparent;border-right: 4px solid transparent;border-top: 4px solid #000;visibility: visible;}\
        .selectedItem {background-color: #f5f5f5}\
    </style>');

    templateEngine.addTemplate = function (templateName, templateMarkup) {
        document.write("<script type='text/html' id='" + templateName + "'>" + templateMarkup + '<' + '/script>');
    };

    templateEngine.addTemplate('ko_table_header', '\
                        <thead>\
                            <tr data-bind="foreach: columns">\
                               <!-- ko if: $data.sortable -->\
                                   <th class="header" data-bind="text: name, css: cssClass, style: { width: width }, click: $root.sort"></th>\
                               <!-- /ko -->\
                               <!-- ko ifnot: $data.sortable -->\
                                   <th class="header" data-bind="text: name, css: cssClass, style: { width: width }"></th>\
                               <!-- /ko -->\
                            </tr>\
                        </thead>');

    templateEngine.addTemplate('ko_table_body', '\
                        <tbody data-bind="foreach: items">\
                            <tr data-bind="click: $root.selectItem, css: {selectedItem : $root.comparator($root.selectedItem(), $data)}">\
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
        init: function (element, valueAccessor) {
            return { 'controlsDescendantBindings': true };
        },
        update: function (element, valueAccessor, allBindingsAccessor) {
            var viewModel = valueAccessor(), allBindings = allBindingsAccessor();

            var tableHeaderTemplateName = allBindings.tableHeaderTemplate || 'ko_table_header',
                tableBodyTemplateName = allBindings.tableBodyTemplate || 'ko_table_body',
                tablePagerTemplateName = allBindings.tablePagerTemplate || 'ko_table_pager';

            $(element).empty();

            var table = element;

            // Render table header
            var headerContainer = table.appendChild(document.createElement('DIV'));
            ko.renderTemplate(tableHeaderTemplateName, viewModel, { templateEngine: templateEngine }, headerContainer, 'replaceNode');

            // Render table body
            var bodyContainer = table.appendChild(document.createElement('DIV'));
            ko.renderTemplate(tableBodyTemplateName, viewModel, { templateEngine: templateEngine }, bodyContainer, 'replaceNode');

            // Render table pager
            var pagerContainer = table.appendChild(document.createElement('DIV'));
            ko.renderTemplate(tablePagerTemplateName, viewModel, { templateEngine: templateEngine }, pagerContainer, 'replaceNode');

        }
    };
})();
