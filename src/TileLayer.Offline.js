'use strict';

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

    /**
     * The Offline Layer should work in the same way as the Tile Layer does
     * when there are no offline tile images saved.
     */
    L.TileLayer.Offline = L.TileLayer.extend({

        /**
         * Constructor of the layer.
         * 
         * @param {String} url URL of the tile map provider.
         * @param {Object} tilesDb An object that implements a certain interface
         * so it's able to serve as the database layer to save and remove the tiles.
         * @param {Object} options This is the same options parameter as the Leaflet
         * Tile Layer, there are no additional parameters. Check their documentation
         * for up-to-date information.
         */
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

        /**
         * Overrides the method from the Tile Layer. Loads a tile given its
         * coordinates.
         * 
         * @param {Object} coords Coordinates of the tile.
         * @param {Function} done A callback to be called when the tile has been
         * loaded.
         * @returns {HTMLElement} An <img> HTML element with the appropriate
         * image URL.
         */
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

        /**
         * Overrides the method from the Tile Layer. Returns the URL for a tile
         * given its coordinates. It tries to get the tile image offline first,
         * then if it fails, it falls back to the original Tile Layer
         * implementation.
         * 
         * @param {Object} coords Coordinates of the tile.
         * @returns {String} The URL for a tile image.
         */
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

        /**
         * Gets the URLs for all the tiles that are inside the given bounds.
         * Every element of the result array is in this format:
         * {key: <String>, url: <String>}. The key is the key used on the
         * database layer to find the tile image offline. The URL is the
         * location from where the tile image will be downloaded.
         * 
         * @param {Object} bounds The bounding box of the tiles.
         * @param {Number} zoom The zoom level of the bounding box.
         * @returns {Array} An array containing all the URLs inside the given
         * bounds.
         */
        getTileUrls: function (bounds, zoom) {
            var tiles = [];
            var originalurl = this._url;

            this.setUrl(this._url.replace('{z}', zoom), true);

            var tileBounds = L.bounds(
                bounds.min.divideBy(this.getTileSize().x).floor(),
                bounds.max.divideBy(this.getTileSize().x).floor()
            );

            for (var i = tileBounds.min.x; i <= tileBounds.max.x; i++) {
                for (var j = tileBounds.min.y; j <= tileBounds.max.y; j++) {
                    var tilePoint = new L.Point(i, j);
                    var url = L.TileLayer.prototype.getTileUrl.call(this, tilePoint);

                    tiles.push({
                        'key': this._getStorageKey(url),
                        'url': url,
                    });
                }
            }

            this.setUrl(originalurl, true);

            return tiles;
        },

        /**
         * Determines the key that will be used on the database layer given
         * a URL.
         * 
         * @param {String} url The URL of a tile image.
         * @returns {String} The key that will be used on the database layer
         * to find a tile image.
         */
        _getStorageKey: function (url) {
            var key = null;

            if (url.indexOf('{s}')) {
                var regexstring = new RegExp('[' + this.options.subdomains.join('|') + ']\.');
                key = url.replace(regexstring, this.options.subdomains['0'] + '.');
            }

            return key || url;
        },
    });

    /**
     * Factory function as suggested by the Leaflet team.
     * 
     * @param {String} url URL of the tile map provider.
     * @param {Object} tilesDb An object that implements a certain interface
     * so it's able to serve as the database layer to save and remove the tiles.
     * @param {Object} options This is the same options parameter as the Leaflet
     * Tile Layer, there are no additional parameters. Check their documentation
     * for up-to-date information.
     */
    L.tileLayer.offline = function (url, tilesDb, options) {
        return new L.TileLayer.Offline(url, tilesDb, options);
    };
}, window));
