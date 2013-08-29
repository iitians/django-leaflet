L.FieldStore = L.Class.extend({
    initialize: function (id, options) {
        this.formfield = document.getElementById(id);
        L.setOptions(this, options);
    },

    load: function () {
        var wkt = new Wkt.Wkt();
        try {
            if (this.formfield.value) {
                wkt.read(this.formfield.value);
                return wkt.toObject(this.options.defaults);
            }
        } catch (e) {  // Ignore empty or malformed WKT strings
        }
        return null;
    },

    save: function (layer) {
        var items = layer.getLayers(),
            is_empty = items.length === 0,
            is_multi = this.options.is_collection || items.length > 1,
            wkt = new Wkt.Wkt();

        if (!is_empty) {
            wkt.fromObject((is_multi ? layer : items[0]));
            this.formfield.value = 'SRID=' + this.options.srid + ';' + wkt.write();
        }
        else {
            this.formfield.value = '';
        }
    }
});


L.GeometryField = L.Class.extend({
    options: {
        field_store_class: L.FieldStore
    },

    initialize: function (options) {
        L.setOptions(this, options);
    },

    addTo: function (map) {
        this._map = map;

        var store_opts = L.Util.extend(this.options, {defaults: map.defaults});
        this.store = new this.options.field_store_class(this.options.id, store_opts);

        this.drawnItems = new L.FeatureGroup();
        map.addLayer(this.drawnItems);

        // Initialize the draw control and pass it the FeatureGroup of editable layers
        var drawControl = new L.Control.Draw({
            edit: {
                featureGroup: this.drawnItems
            },
            draw: {
                polyline: this.options.is_linestring,
                polygon: this.options.is_polygon,
                circle: false, // Turns off this drawing tool
                rectangle: this.options.is_polygon,
                marker: this.options.is_point,
            }
        });

        if (this.options.modifiable) {
            map.addControl(drawControl);

            map.on('draw:created', this.onCreated, this);
            map.on('draw:edited', this.onEdited, this);
            map.on('draw:deleted', this.onDeleted, this);
        }

        this.load();
    },

    load: function () {
        var geometry = this.store.load();
        if (geometry) {
            // Add initial geometry to the map
            geometry.addTo(this._map);
            this.drawnItems.addLayer(geometry);

            // And fit view extent.
            if (typeof(geometry.getBounds) == 'function') {
                this._map.fitBounds(geometry.getBounds());
            }
            else {
                this._map.panTo(geometry.getLatLng());
                this._map.setZoom(module.default_zoom);
            }

            // TODO: SRID should not be necessary
            this.store.save(this.drawnItems);
        }
    },

    onCreated: function (e) {
        var layer = e.layer;
        this._map.addLayer(layer);
        this.drawnItems.addLayer(layer);
        this.store.save(this.drawnItems);
    },

    onEdited: function (e) {
        this.store.save(this.drawnItems);
    },

    onDeleted: function (e) {
        var layer = e.layer;
        this.drawnItems.removeLayer(layer);
        this.store.save(this.drawnItems);
    }
});