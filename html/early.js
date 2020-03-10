// This was functionality of script.js, moved it to here to start the downloading of track history earlier
'use strict';
var Dump1090Version = 'unknown version';
var RefreshInterval = 1000;
var enable_uat = false;
var enable_pf_data = false;
var HistoryChunks = false;
var nHistoryItems = 0;
var HistoryItemsReturned = 0;
var chunkNames;
var PositionHistoryBuffer = [];
var receiverJson;
var deferHistory = [];
var configureReceiver = new Promise((res, rej) => {});
var historyTimeout = 60;
var globeIndex = 0;
var regCache = {};

var databaseFolder = 'db2';

var uuid = null;

try {
  const search = new URLSearchParams(window.location.search);

  const feed = search.get('feed');
  if (feed != null) {
    uuid = feed;
    console.log('uuid: ' + uuid);
  }

  const customTiles = search.get('customTiles');
  if (customTiles) localStorage['customTiles'] = customTiles;
  if (customTiles == 'remove') localStorage.removeItem('customTiles');
} catch (error) {}

// get configuration json files, will be used in initialize function
var get_receiver_defer = fetch('data/receiver.json', {
  method: 'GET',
  cache: 'no-cache'
});
var test_chunk_defer = fetch('chunks/chunks.json', {
  method: 'GET',
  cache: 'no-cache'
});

if (uuid != null) {
  get_receiver_defer = null;
  receiverJson = null;
  Dump1090Version = 'unknown';
  RefreshInterval = 5000;
  configureReceiver.resolve();
  console.time('Downloaded History');
} else {
  get_receiver_defer.then(function(data) {
    get_receiver_defer = null;
    receiverJson = data;
    Dump1090Version = data.version;
    RefreshInterval = data.refresh;
    nHistoryItems = data.history < 2 ? 0 : data.history;
    if (data.globeIndexGrid != null) {
      HistoryChunks = false;
      nHistoryItems = 0;
      globeIndex = 1;
      get_history();
      configureReceiver.resolve();
    } else {
      test_chunk_defer
        .then(function(data) {
          HistoryChunks = true;
          chunkNames = data.chunks;
          nHistoryItems = chunkNames.length;
          enable_uat = data.enable_uat == 'true';
          enable_pf_data = data.pf_data == 'true';
          if (enable_uat) console.log('UAT/978 enabled!');
          console.log('Chunks enabled');
          get_history();
          configureReceiver.resolve();
        })
        .catch(function() {
          HistoryChunks = false;
          get_history();
          configureReceiver.resolve();
        });
    }
  });
}

function get_history() {
  if (!receiverJson.globeIndexGrid) {
    nHistoryItems++;
    var request = fetch('data/aircraft.json', {
      timeout: historyTimeout * 800,

      method: 'GET',
      cache: 'no-cache'
    });
    deferHistory.push(request);
    if (enable_uat) {
      nHistoryItems++;
      //TODO this needs timeout `historyTimeout * 800`
      request = fetch('chunks/978.json', {
        method: 'GET',
        cache: 'no-cache'
      });
      deferHistory.push(request);
    }
  }

  if (HistoryChunks) {
    if (nHistoryItems > 0) {
      console.log('Starting to load history (' + nHistoryItems + ' chunks)');
      console.time('Downloaded History');
      for (var i = chunkNames.length - 1; i >= 0; i--) {
        get_history_item(i);
      }
    }
  } else if (nHistoryItems > 0) {
    console.log('Starting to load history (' + nHistoryItems + ' items)');
    console.time('Downloaded History');
    // Queue up the history file downloads
    for (var i = nHistoryItems - 1; i >= 0; i--) {
      get_history_item(i);
    }
  }
}

function get_history_item(i) {
  var request;
  if (HistoryChunks) {
    //TODO this needs timeout of `historyTimeout * 1000`
    request = fetch(`chunks/${chunkNames[i]}`, {
      method: 'GET',
      cache: 'no-cache'
    });
  } else {
    //TODO this needs timeout of `nHistoryItems * 80, // Allow 40 ms load time per history entry`
    request = fetch(`data/history_${i}.json`, {
      method: 'GET',
      cache: 'no-cache'
    });
  }
  deferHistory.push(request);
}
