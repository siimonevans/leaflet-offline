'use strict';

var tilesDb = {
    getItem: function (key) {
        return localforage.getItem(key);
    },

    setItem: function (key, value) {
        return this._removeItem(key).then(function () {
            return localforage.setItem(key, value);
        });
    },

    clear: function () {
        return localforage.clear();
    },

    _removeItem: function (key) {
        return localforage.removeItem(key);
    }
};

var map = L.map('map-id');
var nTilesToSave = 0;
var saveTilesProgress = 0;
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
    confirmSavingCallback: function (nTiles, continueSaveTiles) {
        if (window.confirm('Save ' + nTiles + '?')) {
            continueSaveTiles();
        }
    },
    confirmRemovalCallback: function (continueRemoveTiles) {
        if (window.confirm('Remove all the tiles?')) {
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
    nTilesToSave = data.nTilesToSave;
    saveTilesProgress = 0;
});

offlineLayer.on('offline:tile-saved', function () {
    saveTilesProgress++;

    if (saveTilesProgress === nTilesToSave) {
        alert('All the tiles were saved.');
    }
});

offlineLayer.on('offline:save-tile-error', function (err) {
    console.error('Error when saving tile: ' + err);
});

offlineLayer.on('offline:tiles-removed', function () {
    alert('All the tiles were removed.');
});

offlineLayer.on('offline:remove-tiles-error', function (err) {
    console.error('Error when removing tiles: ' + err);
});

map.setView({
    lat: 48.858,
    lng: 2.294
}, 18);
