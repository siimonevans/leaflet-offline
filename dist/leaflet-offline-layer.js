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
    L.TileLayer.Offline = L.TileLayer.extend({
        initialize: function (url, tilesDb, options) {
            this._url = url;
            this._tilesDb = tilesDb;

            options = L.Util.setOptions(this, options);

            if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {
                options.tileSize = Math.floor(options.tileSize / 2);

                if (!options.zoomReverse) {
                    options.zoomOffset++;
                    options.maxZoom--;
                } else {
                    options.zoomOffset--;
                    options.minZoom++;
                }

                options.minZoom = Math.max(0, options.minZoom);
            }

            if (typeof options.subdomains === 'string') {
                options.subdomains = options.subdomains.split('');
            }

            if (!L.Browser.android) {
                this.on('tileunload', this._onTileRemove);
            }
        },

        createTile: function (coords, done) {
            var tile = document.createElement('img');

            L.DomEvent.on(tile, 'load', L.bind(this._tileOnLoad, this, done, tile));
            L.DomEvent.on(tile, 'error', L.bind(this._tileOnError, this, done, tile));

            if (this.options.crossOrigin) {
                tile.crossOrigin = '';
            }

            tile.alt = '';

            tile.setAttribute('role', 'presentation');

            this.getTileUrl(coords).then(function (url) {
                tile.src = url;
            }).catch(function (err) {
                throw err;
            });

            return tile;
        },

        getTileUrl: function (coords) {
            var url = L.TileLayer.prototype.getTileUrl.call(this, coords);
            var dbStorageKey = this._getStorageKey(url);

            var resultPromise = this._tilesDb.getItem(dbStorageKey).then(function (data) {
                if (data && typeof data === 'object') {
                    return URL.createObjectURL(data);
                }
                return url;
            }).catch(function (err) {
                throw err;
            });

            return resultPromise;
        },

        getTileUrls: function (bounds, zoom) {
            var url = null;
            var tiles = [];
            var originalurl = this._url;

            // getTileUrl uses current zoom level, we want to overwrite it.
            this.setUrl(this._url.replace('{z}', zoom), true);

            var tileBounds = L.bounds(
                bounds.min.divideBy(this.getTileSize().x).floor(),
                bounds.max.divideBy(this.getTileSize().x).floor()
            );

            for (var i = tileBounds.min.x; i <= tileBounds.max.x; i++) {
                for (var j = tileBounds.min.y; j <= tileBounds.max.y; j++) {
                    var tilePoint = new L.Point(i, j);
                    url = L.TileLayer.prototype.getTileUrl.call(this, tilePoint);
                    tiles.push({
                        'key': this._getStorageKey(url),
                        'url': url,
                    });
                }
            }

            // Restore the overwritten url.
            this.setUrl(originalurl, true);

            return tiles;
        },

        getSubDomainsLength: function () {
            return this.options.subdomains.length;
        },

        _getStorageKey: function (url) {
            var key = null;

            if (url.indexOf('{s}')) {
                var regexstring = new RegExp('[' + this.options.subdomains.join('|') + ']\.');
                key = url.replace(regexstring, this.options.subdomains['0'] + '.');
            }

            return key || url;
        },
    });

    L.tileLayer.offline = function (url, tilesDb, options) {
        return new L.TileLayer.Offline(url, tilesDb, options);
    };
}, window));

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

            var requests = [];

            for (var i = 0; i < tileUrls.length; i++) {
                var tileUrl = tileUrls[i];

                (function (i, tileUrl) {
                    requests[i] = new XMLHttpRequest();
                    requests[i].open('GET', tileUrl.url, true);
                    requests[i].responseType = 'blob';
                    requests[i].onreadystatechange = function () {
                        if (requests[i].readyState === XMLHttpRequest.DONE && requests[i].status === 200) {
                            self._baseLayer.fire('offline:tile-downloaded');
                            self._saveTile(tileUrl.key, requests[i].response);
                        }
                    };
                    requests[i].send();
                })(i, tileUrl);
            }
        },

        _saveTile: function (tileUrlKey, blob) {
            var self = this;

            this._tilesDb.setItem(tileUrlKey, blob).then(function () {
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

            if (this.options.confirmRemovalCallback) {
                this.options.confirmRemovalCallback(continueRemoveTiles);
            } else {
                continueRemoveTiles();
            }
        }
    });

    L.control.offline = function (baseLayer, tilesDb, options) {
        return new L.Control.Offline(baseLayer, tilesDb, options);
    };
}, window));

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./TileLayer.Offline', './Control.Offline'], factory);
    } else if (typeof exports === 'object' && module.exports) {
        module.exports = factory(require('./TileLayer.Offline'), require('./Control.Offline'));
    }
}(function (TileLayerOffline, ControlOffline) {
}));
