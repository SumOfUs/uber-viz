/*!
 * dc-addons v0.13.5
 *
 * 2016-08-17 08:09:00
 *
 */
(function () {
    'use strict';
    var LONG_TOOLTIPS = ['USA', 'Boston, Massachusetts, USA', 'San Francisco, California, USA', 'UK'];
    var POINTER_SIZE = 10;

    if (dc.tooltipMixin) {
        return false;
    }

    dc.tooltipMixin = function (_chart) {

        if (_chart) {
            _chart.tip = {};
            _chart.tip.tooltip = null;

            _chart.tip.init = function () {
                if (_chart.tip.tooltip === null) {
                    var wrapper = _chart.svg().selectAll('g.sub'); // if the chart has sub grouping (e.g. composite or series)

                    // if no sub grouping then just use the chart svg
                    if (wrapper.empty()) {
                        wrapper = _chart.svg();
                    }

                    // get all elements that want a tooltip
                    _chart.tip.elements = wrapper.selectAll('rect.bar,circle.dot,g.pie-slice,circle.bubble,g.row rect');

                    // nothing to tip so exit
                    if (_chart.tip.elements.empty()) {
                        return false;
                    }

                    // create the tip object
                    _chart.tip.tooltip = d3.tip()
                        .attr('class', 'tip')
                        .html(function (d, i, subI) {
                            var title = _chart.title();

                            // if the chart is a composite chart
                            if (_chart.children) {
                                title = _chart.children()[subI].title();
                            }

                            // if the chart is a paired row chart
                            if (typeof title !== 'function') {
                                title = title[subI];
                            }

                            // if a stackable chart
                            if (_chart.stack) {
                                title = _chart.title(d.layer);
                            }

                            var data = d;
                            if (d.data) {
                                data = d.data;
                            }

                            return title(data);
                        });


                    var offsetY, offsetX, direction;

                    _chart.tip.tooltip.offset([-10, 0]);
                    // _chart.tip.tooltip.direction('e');

                    // add the tip to the elements
                    _chart.tip.elements.call(_chart.tip.tooltip);
                    _chart.tip.elements.on('mouseleave', _chart.tip.tooltip.hide);
                    _chart.tip.elements.on('mouseover', function(d, i) {
                        if (d3.select('.map-graphic').style('position') === 'fixed') {
                            if (LONG_TOOLTIPS.indexOf(d.key) !== -1) {
                                direction = 'e';
                                offsetX = POINTER_SIZE;
                                offsetY = -window.scrollY;
                            } else {
                                direction = 'n';
                                offsetX = 0;
                                offsetY = -window.scrollY - POINTER_SIZE;
                            }
                        } else {
                            offsetY = -POINTER_SIZE;
                            offsetX = 0;
                            direction = 'n';
                        }
                        _chart.tip.tooltip.offset([offsetY, offsetX]);
                        _chart.tip.tooltip.direction(direction);
                        _chart.tip.tooltip.show(d, i);
                    });

                    // remove standard tooltips
                    _chart.tip.elements.each(function () {
                        var el = d3.select(this);
                        var title = el.select('title');

                        if (title.empty()) { // MONKEY PATCH
                          title = d3.select(this.parentNode).select('title');
                        }

                        if (title.empty()) {
                            return false;
                        }

                        el.attr('data-title', title.text());
                        title.remove();
                    });
                }

                return _chart;
            };

            _chart.tip.destroy = function () {
                if (_chart.tip.tooltip !== null) {
                    _chart.tip.elements.on('mouseover', null).on('mouseleave', null); // remove mouse events
                    _chart.tip.tooltip.destroy(); // destroy the tip
                    _chart.tip.tooltip = null; // and set it to null

                    // add the standard tooltips back in
                    _chart.tip.elements.each(function () {
                        var el = d3.select(this);
                        el.append('title').text(el.attr('data-title'));
                    });
                }

                return _chart;
            };

            _chart.tip.reinit = function () {
                _chart.tip.destroy();
                _chart.tip.init();
            };

            _chart.tip.init();
        }

        return _chart;
    };
})();
