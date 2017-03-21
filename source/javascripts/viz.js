(function(){


  var viz = {
    width: 1060,
    height: 600,
    projection: d3.geo.robinson(),    
    categoryColors: {
      "Corporate citizenship": '#34a853',
      'Regulation and lobbying': '#0c0081',
      'Pay and worker treatment': '#df7c08'
    },
    currentCategories: {},
    mutuallyExclusiveCategories: true,
    searched: '',

    initialize: function() {
      viz.path = d3.geo.path().projection(viz.projection);

      viz.mapSvg = d3.select("#world-map").append("svg")
        .attr("width", viz.width)
        .attr("height", viz.height);

      viz.bubbleSvg = d3.select('#map-bubbles-chart').append('svg')
        .attr("width", viz.width)
        .attr("height", viz.height);

      viz.renderCategories();
      viz.setupFancyScroll();
      d3.csv('/javascripts/uber-cities.csv', viz.useCities);
      d3.json("/javascripts/world-50m.json", viz.usePaths);
    },

    setupFancyScroll: function() {
      var stationaryBar = d3.select('.filter-bar');
      var animatedBar = d3.select('.uber-viz__animated-filter-bar');
      window.addEventListener('scroll', function(){ viz.scrolled = true; });
      window.setInterval(function(){
        if (!viz.scrolled) return;
        animatedBar.classed('uber-viz__animated-filter-bar--visible', !viz.checkOnScreen(stationaryBar.node()))
        viz.scrolled = false;
      }, 100);
      d3.select('.filter-bar__toggle-filter').on('click', function(e){
        animatedBar.classed('filter-bar--compacted', !animatedBar.classed('filter-bar--compacted'));
      });
    },

    checkOnScreen: function(el) {
      var rect = el.getBoundingClientRect();
      var viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
      return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
    },

    renderCategories: function() {
      var size = _.size(viz.categoryColors) + 1;
      var container = d3.selectAll('.filter-bar');
      var widthStyle = 'width: '+ (100 / size) + '%;';
      _.each(_.keys(viz.categoryColors), function(label) {
        var category = container.append('div')
          .attr('class', 'filter-bar__category')
          .attr('style', widthStyle)
          .attr('data-label', label);
        category.append('div')
          .attr('class', 'filter-bar__category-name')
          .text(label);
        category.append('div')
          .attr('class', 'filter-bar__category-color')
          .attr('style', 'background-color: '+viz.categoryColors[label]+';');
        category.on('click', viz.toggleCategory);
      });
      container.select('.filter-bar__search-box').attr('style', widthStyle);
    },

    colorTooltip: function(categoryCounts) {
      var total = _.reduce(_.values(categoryCounts), function(a, b) { return a + b; }, 0);
      var barHtml = _.map(_.keys(categoryCounts), function(k) {
        var percent = 100 * categoryCounts[k] / total;
        return "<div style='background-color: "+viz.categoryColors[k]+"; width: "+percent+"%;''></div>";
      }).join('');
      return "<div class='bubble-chart__tooltip-color-bar'>"+barHtml+"</div>";
    },

    search: function(value) {
      var inputs = d3.selectAll('.filter-bar__search-input').property('value', value);
      var value = value.length > 1 ? value : '';
      viz.searched = value;
      var re = new RegExp(value, 'i');
      viz.searchDimension.filter(function(d) {
        return d.search(re) !== -1;
      });
      dc.redrawAll();
    },

    toggleCategory: function() {
      var label = d3.select(this).attr('data-label');
      var els = d3.selectAll('[data-label="'+label+'"]');
      var adding = !(viz.currentCategories[label] === true);
      if (viz.mutuallyExclusiveCategories) {
        viz.currentCategories = {};
        d3.selectAll('.filter-bar__category--selected').classed('filter-bar__category--selected', false);
      }
      viz.currentCategories[label] = adding;
      els.classed('filter-bar__category--selected', adding);
      var noneSelected = _.values(viz.currentCategories).indexOf(true) === -1;
      viz.categoryDimension.filter(function(category){
        return noneSelected || viz.currentCategories[category] === true;
      });
      dc.redrawAll();
    },

    usePaths: function(error, world) {
      if (error) throw error;

      viz.mapSvg.append('g')
        .append("path")
        .datum(topojson.merge(world, world.objects.countries.geometries))
        .attr("class", "land")
        .attr("d", viz.path);
    },

    useCities: function(error, cities){
      if (error) console.error(error);

      viz.initCrossfilter(cities);
      viz.initBubbles();
      viz.initTable();
      viz.initAutocomplete(cities);

      dc.renderAll();
      dc.tooltipMixin(viz.mapBubbles);
      // viz.mapBubbles.tip.elements.on('mouseleave', null);
    },

    initAutocomplete: function(cities) {
      var inputs = d3.selectAll('.filter-bar__search-input');
      inputs.each(function() {
        viz.autocomplete = new Awesomplete(this, {
          list: _.uniq(_.map(cities, function(c) { return c.location; }))
        });
      });
      inputs.on('awesomplete-selectcomplete', function() {
        viz.search(this.value);
      }).on('keyup', function() {
        viz.search(this.value);
        return true;
      });
    },

    initCrossfilter: function(cities) {
      viz.ndx = crossfilter(cities);
      viz.locationDimension = viz.ndx.dimension(function(d) { return d.location; });
      viz.searchDimension = viz.ndx.dimension(function(d) { return d.location; });
      viz.categoryDimension = viz.ndx.dimension(function(d) { return d.category; });
      viz.locationGroup = viz.locationDimension.group().reduce(
        function (p, v) {
          if (p.lat !== v.lat) p.lat = v.lat;
          if (p.long !== v.long) p.long = v.long;
          p.count++;
          if (p.categoryCounts.hasOwnProperty(v.category)) {
            p.categoryCounts[v.category]++;
          } else {
            p.categoryCounts[v.category] = 1;
          }
          p.taglines = _.union(p.taglines, [v.tag_line]);
          p.location = v.location;
          return p;
        },
        function (p, v) {
          p.count--;
          p.categoryCounts[v.category]--;
          if (p.categoryCounts[v.category] < 1) delete p.categoryCounts[v.category];
          p.taglines = _.difference(p.taglines, [v.tag_line]);
          return p;
        },
        function () {
          return {
            lat: null,
            long: null,
            categoryCounts: {},
            taglines: [],
            count: 0
          };
        }
      );
    },

    initBubbles: function() {
      var colorDomain= [], colorRange = [];
      _.each(viz.categoryColors, function(v, k) {
        colorDomain.push(k); colorRange.push(v);
      });

      viz.mapBubbles = dc.bubbleChart('#map-bubbles-chart')
        .svg(d3.select('#map-bubbles-chart svg'))
        .width(viz.width*1.08)
        .height(viz.height*1.08)
        .dimension(viz.locationDimension)
        .group(viz.locationGroup)
        .keyAccessor(function(p) {
          projected = viz.projection([p.value.long, p.value.lat]);
          return projected ? projected[0] : 0;
        })
        .valueAccessor(function(p) {
          projected = viz.projection([p.value.long, p.value.lat]);
          return projected ? -projected[1] : 0;
        })
        .radiusValueAccessor(function(p) { return p.value.count; })
        .x(d3.scale.linear().domain([0, viz.width]))
        .y(d3.scale.linear().domain([-1 * viz.height, 0]))
        .minRadius(3)
        .title(function(p) {
          if (p.value.taglines.length > 1) {
            var taglines = '<ul><li>'+p.value.taglines.join('</li><li>')+'</li></ul>';
          } else {
            var taglines = '<div class="bubble-chart__single-tagline">'+p.value.taglines[0]+'</div>';
          }
          return viz.colorTooltip(p.value.categoryCounts)+"<div class='bubble-chart__taglines'><h4>"+p.value.location+"</h4>"+taglines+"</div>";
        })
        .colorAccessor(function(p) {
          var max = _.chain(p.value.categoryCounts).max().value();
          category = _.chain(p.value.categoryCounts).invert().value()[max];
          return category;
        })
        .colors(d3.scale.ordinal().domain(colorDomain).range(colorRange))
        .addFilterHandler(function(filters, filter){
          filters.length = 0; // empty the array
          filters.push(filter);
          return filters;
        })
        .renderLabel(false)
        .on('renderlet.circleclick', function(chart) {
          chart.selectAll('circle').on("click", function(datum) { viz.searchByClick(datum.key); });
        });
      ;
    },

    searchByClick: function(locationName) {
      value = (locationName === viz.searched) ? '' : locationName;
      viz.search(value);
    },

    initTable: function() {
      var incidentTemplate = d3.select('#incident-card-template').html();
      _.templateSettings = {
        interpolate: /\{\{(.+?)\}\}/g
      };
      var table = dc.dataGrid('#stories-table')
        .dimension(viz.locationDimension)
        .group(function(d) { return d; })
        .size(100)
        .on('renderlet', function() {
          if (viz.masonry) viz.masonry.destroy();
          viz.masonry = new Masonry('.dc-grid-top', {
            columnWidth: d3.select('.dc-grid-item').node()
          });
        })
        .html(function(d) {
          return _.template(incidentTemplate)({
            d: d,
            color: viz.categoryColors[d.category]
          });
        });
      ;
    }
  }
  viz.initialize();
})();
