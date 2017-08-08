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
            saveButtonHtml: '+',
            saveButtonTitle: 'Save tiles',
            removeButtonHtml: '-',
            removeButtonTitle: 'Remove tiles',
            minZoom: 0,
            maxZoom: 19,
            confirmSavingCallback: null,
            confirmRemovalCallback: null
        },

        initialize: function (baseLayer, tilesDb, options) {
            this._baseLayer = baseLayer;
            this._tilesDb = tilesDb;

            Util.setOptions(this, options);
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-control-offline leaflet-bar');

            this._createButton(this.options.saveButtonHtml, this.options.saveButtonTitle, 'save-tiles-button', container, this._saveTiles);
            this._createButton(this.options.removeButtonHtml, this.options.removeIconTitle, 'remove-tiles-button', container, this._removeTiles);

            return container;
        },

        _createButton: function (html, title, className, container, fn) {
            var link = DomUtil.create('a', className, container);
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
                self._baseLayer.fire('offline:save-start', tileUrls.length);
                self._downloadTiles(tileUrls);
            };

            if (this.options.confirmSavingCallback) {
                this.options.confirmSavingCallback(tileUrls.length, continueSaveTiles);
            } else {
                continueSaveTiles();
            }
        },

        _downloadTiles: function (tileUrls) {
            var self = this;

            for (var i = 0; i < tileUrls.length; i++) {
                var tileUrl = tileUrls[i];

                var xhr = new XMLHttpRequest();
                xhr.open('GET', tileUrl.url);
                xhr.responseType = 'blob';
                xhr.onreadystatechange = function () {
                    if (this.readyState === 4 && this.status === 200) {
                        self._baseLayer.fire('offline:tile-downloaded');
                        self._saveTile(tileUrl.key, this.response);
                    } else {
                        self._baseLayer.fire('offline:download-tile-error', {
                            tileUrl: tileUrl.url,
                            requestStatus: this.status
                        });
                    }
                };
                xhr.send();
            }
        },

        _saveTile: function (tileUrl, blob) {
            var self = this;

            this._tilesDb.setItem(tileUrl, blob).then(function () {
                self._baseLayer.fire('offline:tile-saved');
            }).catch(function (err) {
                self._baseLayer.fire('offline:save-tile-error', {
                    error: err
                });
            });
        },

        _removeTiles: function () {
            var self = this;

            var continueRemoveTiles = function () {
                self._tilesDb.clear().then(function () {
                    self._baseLayer.fire('offline:tiles-removed');
                }).catch(function (err) {
                    self._baseLayer.fire('offline:remove-tiles-error', {
                        error: err
                    });
                });
            };

            if (this.options.confirmRemoval) {
                this.options.confirmRemoval(continueRemoveTiles);
            } else {
                continueRemoveTiles();
            }
        }
    });

    L.control.offline = function (baseLayer, tilesDb, options) {
        return new L.Control.Offline(baseLayer, tilesDb, options);
    };
}, window));
