'use strict';

var tilesDb = {
    getItem: function (key) {
        return localforage.getItem(key);
    },

    saveTiles: function (tileUrls) {
        var self = this;

        var promises = [];

        for (var i = 0; i < tileUrls.length; i++) {
            var tileUrl = tileUrls[i];

            (function (i, tileUrl) {
                promises[i] = new Promise(function (resolve, reject) {
                    var request = new XMLHttpRequest();
                    request.open('GET', tileUrl.url, true);
                    request.responseType = 'blob';
                    request.onreadystatechange = function () {
                        if (request.readyState === XMLHttpRequest.DONE) {
                            if (request.status === 200) {
                                resolve(self._saveTile(tileUrl.key, request.response));
                            } else {
                                reject({
                                    status: request.status,
                                    statusText: request.statusText
                                });
                            }
                        }
                    };
                    request.send();
                });
            })(i, tileUrl);
        }

        return Promise.all(promises);
    },

    size: function () {
        return localforage.length();
    },

    clear: function () {
        return localforage.clear();
    },

    _saveTile: function (tileUrlKey, blob) {
        return this._setItem(tileUrlKey, blob);
    },

    _setItem: function (key, value) {
        return this._removeItem(key).then(function () {
            return localforage.setItem(key, value);
        });
    },

    _removeItem: function (key) {
        return localforage.removeItem(key);
    }
};

var map = L.map('map-id');
var offlineLayer = L.tileLayer.offline('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', tilesDb, {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abc',
    minZoom: 13,
    maxZoom: 19,
    crossOrigin: true
});
var offlineControl = L.control.offline(offlineLayer, tilesDb, {
    saveButtonHtml: '<i class="fa fa-download" aria-hidden="true"></i>',
    removeButtonHtml: '<i class="fa fa-trash" aria-hidden="true"></i>',
    confirmSavingCallback: function (nTilesToSave, continueSaveTiles) {
        if (window.confirm('Save ' + nTilesToSave + '?')) {
            continueSaveTiles();
        }
    },
    confirmRemovalCallback: function (nTilesToRemove, continueRemoveTiles) {
        if (window.confirm('Remove ' + nTilesToRemove + '?')) {
            continueRemoveTiles();
        }
    },
    minZoom: 13,
    maxZoom: 19
});

offlineLayer.addTo(map);
offlineControl.addTo(map);

offlineLayer.on('offline:below-min-zoom-error', function () {
    alert('Can not save tiles below minimum zoom level.');
});

offlineLayer.on('offline:save-start', function (data) {
    console.log('Saving ' + data.nTilesToSave + ' tiles.');
});

offlineLayer.on('offline:save-end', function (data) {
    alert('All the tiles were saved.');
});

offlineLayer.on('offline:save-error', function (err) {
    console.error('Error when saving tiles: ' + err);
});

offlineLayer.on('offline:remove-start', function (data) {
    console.log('Removing ' + data.nTilesToRemove + ' tiles.');
});

offlineLayer.on('offline:remove-end', function () {
    alert('All the tiles were removed.');
});

offlineLayer.on('offline:remove-error', function (err) {
    console.error('Error when removing tiles: ' + err);
});

offlineLayer.on('offline:size-error', function (err) {
    console.error('Error when getting the size of the database: ' + err);
});

map.setView({
    lat: 48.858,
    lng: 2.294
}, 18);
