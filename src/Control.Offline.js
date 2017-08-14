(function (factory, window) {

    if (typeof define === 'function' && define.amd) {
        define(['leaflet'], factory);
    } else if (typeof exports === 'object' && module.exports) {
        module.exports = factory(require('leaflet'));
    } else if (typeof window !== 'undefined') {
        if (typeof window.L === 'undefined') {
            throw 'Leaflet must be loaded first!';
        }
        factory(window.L);
    }
}(function (L) {
    L.Control.Offline = L.Control.extend({
        options: {
            position: 'topleft',
            saveButtonHtml: 'S',
            saveButtonTitle: 'Save tiles',
            removeButtonHtml: 'R',
            removeButtonTitle: 'Remove tiles',
            minZoom: 0,
            maxZoom: 19,
            confirmSavingCallback: null,
            confirmRemovalCallback: null
        },

        initialize: function (baseLayer, tilesDb, options) {
            this._baseLayer = baseLayer;
            this._tilesDb = tilesDb;

            L.Util.setOptions(this, options);
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-control-offline leaflet-bar');

            this._createButton(this.options.saveButtonHtml, this.options.saveButtonTitle, 'save-tiles-button', container, this._saveTiles);
            this._createButton(this.options.removeButtonHtml, this.options.removeIconTitle, 'remove-tiles-button', container, this._removeTiles);

            return container;
        },

        _createButton: function (html, title, className, container, fn) {
            var link = L.DomUtil.create('a', className, container);
            link.innerHTML = html;
            link.href = '#';
            link.title = title;

            L.DomEvent.disableClickPropagation(link);
            L.DomEvent.on(link, 'click', L.DomEvent.stop);
            L.DomEvent.on(link, 'click', fn, this);
            L.DomEvent.on(link, 'click', this._refocusOnMap, this);

            return link;
        },

        _saveTiles: function () {
            var self = this;

            var bounds = null;
            var zoomLevels = [];
            var tileUrls = [];
            var currentZoom = this._map.getZoom();
            var latlngBounds = this._map.getBounds();

            if (currentZoom < this.options.minZoom) {
                self._baseLayer.fire('offline:below-min-zoom-error');

                return;
            }

            for (var zoom = currentZoom; zoom <= this.options.maxZoom; zoom++) {
                zoomLevels.push(zoom);
            }

            for (var i = 0; i < zoomLevels.length; i++) {
                bounds = L.bounds(this._map.project(latlngBounds.getNorthWest(), zoomLevels[i]),
                    this._map.project(latlngBounds.getSouthEast(), zoomLevels[i]));
                tileUrls = tileUrls.concat(this._baseLayer.getTileUrls(bounds, zoomLevels[i]));
            }

            var continueSaveTiles = function () {
                self._baseLayer.fire('offline:save-start', {
                    nTilesToSave: tileUrls.length
                });

                self._tilesDb.saveTiles(tileUrls).then(function () {
                    self._baseLayer.fire('offline:save-end');
                }).catch(function (err) {
                    self._baseLayer.fire('offline:save-error', {
                        error: err
                    });
                });
            };

            if (this.options.confirmSavingCallback) {
                this.options.confirmSavingCallback(tileUrls.length, continueSaveTiles);
            } else {
                continueSaveTiles();
            }
        },

        _removeTiles: function () {
            var self = this;

            var dbSize = null;

            var continueRemoveTiles = function () {
                self._baseLayer.fire('offline:remove-start', {
                    nTilesToRemove: dbSize
                });

                self._tilesDb.clear().then(function () {
                    self._baseLayer.fire('offline:remove-end');
                }).catch(function (err) {
                    self._baseLayer.fire('offline:remove-error', {
                        error: err
                    });
                });
            };

            this._tilesDb.size().then(function (size) {
                dbSize = size;

                if (self.options.confirmRemovalCallback) {
                    self.options.confirmRemovalCallback(size, continueRemoveTiles);
                } else {
                    continueRemoveTiles();
                }
            }).catch(function (err) {
                self._baseLayer.fire('offline:size-error', {
                    error: err
                });
            });
        }
    });

    L.control.offline = function (baseLayer, tilesDb, options) {
        return new L.Control.Offline(baseLayer, tilesDb, options);
    };
}, window));
