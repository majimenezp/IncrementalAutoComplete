(function ($) {
    $.widget("ui.inccombobox", {
        options: {
            pagesize: 30,
            minLength: 0,
            onSelect: null
        },
        container: null,
        input: null,
        lista: null,
        _create: function () {
            var self = this,
					select = this.element.hide(),
					selected = select.children(":selected"),
                    doc = this.element[0].ownerDocument,
            value = selected.val() ? selected.text() : "";
            var input = $("<input>")
					.insertAfter(select)
					.val(value)//ui-widget ui-widget-content ui-corner-left
					.addClass("ui-autocomplete-input ui-widget ui-widget-content ui-corner-left").focusin(function () { this.select(); })
                    .bind("keydown.inccombobox", function (event) {
                        var keyCode = $.ui.keyCode;
                        switch (event.keyCode) {
                            case keyCode.PAGE_UP:
                                self._move("previousPage", event);
                                break;
                            case keyCode.PAGE_DOWN:
                                self._move("nextPage", event);
                                break;
                            case keyCode.UP:
                                self._move("previous1", event);
                                // prevent moving cursor to beginning of text field in some browsers
                                event.preventDefault();
                                break;
                            case keyCode.DOWN:
                                self._move("next", event);
                                // prevent moving cursor to end of text field in some browsers
                                event.preventDefault();
                                break;
                            case keyCode.ENTER:
                                // when menu is open or has focus
                                if (self.active) {
                                    event.preventDefault();
                                }
                                //passthrough - ENTER and TAB both select the current element
                            case keyCode.TAB:
                                if (!self.active) {
                                    return;
                                }
                                self.select();
                                //self.menu.select();
                                break;
                            case keyCode.ESCAPE:
                                self.element.val(self.term);
                                self.close(event);
                                break;
                            case keyCode.SHIFT:
                            case keyCode.CONTROL:
                            case 18:
                                // ignore metakeys (shift, ctrl, alt)
                                break;
                            default:
                                // keypress is triggered before the input value is changed
                                clearTimeout(self.searching);
                                self.searching = setTimeout(function () {
                                    self.search(null, event);
                                }, self.options.delay);
                                break;
                        }
                    })
			        .bind("focus.inccombobox", function () {
			            self.previous = self.element.val();
			        })
			        .bind("blur.inccombobox", function (event) {
			            clearTimeout(self.searching);
			            // clicks on the menu (or a button to trigger a search) will cause a blur event
			            // TODO try to implement this without a timeout, see clearTimeout in search()
			            //			            self.closing = setTimeout(function () {
			            //			                self.close(event);
			            //			            }, 150);
			        });
            this.input = input;
            input.selItem = function (value) { return self._selectItem(value); };
            var container = $("<div></div>")
            .addClass("ui-menu ui-widget ui-widget-content ui-corner-all ui-autocomplete")
            //
            .css({ top: 0, left: 0, height: 200, width: 200, "overflow-y": "auto", "overflow-x": "hidden", "margin": 0 })
            .attr({
                role: "listbox", id: this.id + "div"
            })
            .hide()
            .appendTo("body", doc);
            container[0].input = input;
            container[0].options = this.options;
            container[0].self = self;
            this.container = container;
            var lista = $("<ul></ul>")
			.appendTo(container)
            .css({ "list-style": "none", "padding-left": 0, "margin-top": 0, "margin-left": 0 })
            .attr({
                role: "listbox",
                id: this.id + "ul",
                "aria-activedescendant": "ui-active-menuitem"
            });

            this.lastpage = 1;
            this.lastvalue = "";
            this.pages = 0;
            this.menu = lista;
            container.hide();
            this._initSource();
            this.response = function () {
                return self._response.apply(self, arguments);
            };
            $("<button>&nbsp;</button>")
            .attr("tabIndex", -1)
            .attr("title", "Show All Items")
            .insertAfter(input)
            .button({
                icons: {
                    primary: "ui-icon-triangle-1-s"
                },
                text: false
            })
            .removeClass("ui-corner-all")
            .addClass("ui-corner-right ui-button-icon")
            .click(function () {
                if (container.is(":visible")) {
                    container.hide();
                    return;
                }
                self.search(input.val());
                container.show().position({ my: "left top", at: "left bottom", of: input, collision: "none" });
            });
            container.scroll(function () {
                if ((container[0].scrollTop + container.height() + 4) >= container[0].scrollHeight) {
                    self._loadIncremental(input.val());
                }
            });

        },
        search: function (value, event) {
            value = value != null ? value : this.input.val();
            if (value.length < this.options.minLength) {
                return this.close(event);
            }
            clearTimeout(this.closing);
            if (this._trigger("search") === false) {
                return;
            }
            return this._search(value);
        }
        , _search: function (value) {
            this.term = this.element
			.addClass("ui-autocomplete-loading")
            // always save the actual value, not the one passed as an argument
			.val();
            if (this.lastvalue != value || value == "") {
                this.lastvalue = value;
                this.lastpage = 1;
                this.source({ search: value, pagesize: this.options.pagesize, page: this.lastpage }, this.response);
            }
        }
        , _loadIncremental: function (value) {
            if (this.lastpage >= this.pages) {
                return;
            }
            if (this.lastvalue == value) {
                this.lastpage += 1;
            }
            else {
                this.lastpage = 1;
            }
            this.source({ search: value, pagesize: this.options.pagesize, page: this.lastpage }, this.response);
        }
        , _initSource: function () {
            var array,
			url;
            if ($.isArray(this.options.source)) {
                array = this.options.source;
                this.source = function (request, response) {
                    // escape regex characters
                    var matcher = new RegExp($.ui.autocomplete.escapeRegex(request.term), "i");
                    response($.grep(array, function (value) {
                        return matcher.test(value.label || value.value || value);
                    }));
                };
            } else if (typeof this.options.source === "string") {
                url = this.options.source
                this.source = function (request, response) {
                    $.getJSON(url, request, response);
                };
            } else {
                this.source = this.options.source;
            }
        }
        , _response: function (content) {
            this.pages = content.pages;
            if (content.results.length) {
                var elems = this._normalize(content.results);
                if (content.page == 1) {
                    this.menu.children().remove();
                }
                this._suggest(elems);
                this.open();
            } else {
                this.close();
            }
            //this.element.removeClass( "ui-autocomplete-loading" );
        }
        , close: function (event) {
            clearTimeout(this.closing);
            if (this.menu.is(":visible")) {
                this._trigger("close", event);
                this.container.hide();
                //this.menu.deactivate();
            }
            if (this.previous !== this.element.val()) {
                this._trigger("change", event);
            }
        }
        , open: function () {
            this.container.show().position({ my: "left top", at: "left bottom", of: this.input, collision: "none" }); ;
        }
        , _normalize: function (items) {
            // assume all items have the right format when the first item is complete
            if (items.length && items[0].label && items[0].value) {
                return items;
            }
            return $.map(items, function (item) {
                if (typeof item === "string") {
                    return {
                        label: item,
                        value: item
                    };
                }
                return $.extend({
                    label: item.label || item.value,
                    value: item.value || item.label
                }, item);
            });
        }
        , _suggest: function (items) {
            var ul = this.menu;
            this._renderMenu(ul, items);
            // TODO refresh should check if the active item is still in the dom, removing the need for a manual deactivate
            //		    this.menu.deactivate();
            //		    this.menu.refresh();
            //		    this.menu.element.show().position({
            //			    my: "left top",
            //			    at: "left bottom",
            //			    of: this.element,
            //			    collision: "none"
            //		    });

            //		    menuWidth = ul.width( "" ).width();
            //		    textWidth = this.element.width();
            //		    ul.width( Math.max( menuWidth, textWidth ) );
        }
        , _selectItem: function (object) {
            var elemn = $(object).parent().parent()[0];
            var label = object.text();
            var selValue = $(object).attr("value");
            this.element.val(selValue);
            this.input.val(label);
            if (typeof elemn.options.onSelect === "function") {
                elemn.options.onSelect(this, { "label": label, "value": selValue });
            }
            $(elemn).hide();
        }
        , _onItemClick: function (event) {
            $(this).parent().parent()[0].input.selItem($(this));
        }
        , select: function () {
            this._selectItem(this.active);
        }
        , _move: function (direction, event) {
            if (!this.container.is(":visible")) {
                this.search(null, event);
                return;
            }
            this[direction]();
        }
	    , _renderMenu: function (ul, items) {
	        var self = this;
	        $.each(items, function (index, item) {
	            self._renderItem(ul, item);
	        });
	    }
	    , _renderItem: function (ul, item) {
	        return $("<li></li>")
                .attr({ value: item.value })
			    .data("item.autocomplete ui-corner-all", item)
                .addClass("ui-menu-item")
			    .append("<a>" + item.label + "</a>")
			    .appendTo(ul)
                .mouseenter(function () {
                    $(this).parent().parent()[0].self.activate($(this));
                })
			    .mouseleave(function () {
			        $(this).parent().parent()[0].self.deactivate();
			    })
                .click(this._onItemClick);
	        this.input.append($("<option></option>").
                attr("value", item.value).
                text(item.label));
	    }
        , activate: function (item) {
            this.deactivate();
            var value = "";
            if (this.hasScroll()) {
                var offset = item.offset().top - this.container.offset().top,
                scroll = this.container.attr("scrollTop"),
                elementHeight = this.container.height();
                if (offset < 0) {
                    value = scroll + offset;
                    this.container.attr("scrollTop", scroll + offset);
                } else if (offset > elementHeight) {
                    value = scroll + offset - elementHeight + item.height();
                    this.container.attr("scrollTop", scroll + offset - elementHeight + item.height());
                }
                //$("#prueba001").val(offset + "|" + scroll + "|" + elementHeight + "|" + item.height() + "|" + value);
                //this.container[0].scrollTop + container.height() + "|" + container[0].scrollHeight + "|" + $(this).scrollTop());
            }

            this.active = item.eq(0)
			    .children("a")
				    .addClass("ui-state-hover")
				    .attr("id", "ui-active-menuitem")
			    .end();
            //            this._trigger("focus", null, { item: item });
        },
        hasScroll: function () {
            return this.container.height() < this.container.attr("scrollHeight");
        },
        deactivate: function () {
            if (!this.active) { return; }
            this.active.children("a")
	    		.removeClass("ui-state-hover")
			    .removeAttr("id");
            this._trigger("blur");
            this.active = null;
        }
        , previous1: function () {
            this.move("prev", "li:last");
        }
        , next: function () {
            this.move("next", "li:first");
        },
        move: function (direction, edge) {
            if (!this.active) {
                this.activate(this.menu.children(edge));
                return;
            }
            var next = this.active[direction]();
            if (next.length) {
                this.activate(next);
            } else {
                this.activate(this.menu.children(edge));
            }
        }
    });
})(jQuery);