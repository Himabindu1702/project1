

/* global chrome, Promise */

import {assert} from 'chrome://resources/js/assert.m.js';

function lookupDefaultZoom(streamInfo) {

  if (!chrome.tabs || streamInfo.tabId < 0) {
    return Promise.resolve(1);
  }

  return new Promise(function(resolve, reject) {
    chrome.tabs.getZoomSettings(streamInfo.tabId, function(zoomSettings) {
      resolve(zoomSettings.defaultZoomFactor);
    });
  });
}

function lookupInitialZoom(streamInfo) {

  if (!chrome.tabs || streamInfo.tabId < 0) {
    return Promise.resolve(1);
  }

  return new Promise(function(resolve, reject) {
    chrome.tabs.getZoom(streamInfo.tabId, resolve);
  });
}

export class BrowserApi {

  constructor(streamInfo, defaultZoom, initialZoom, zoomBehavior) {
    this.streamInfo_ = streamInfo;
    this.defaultZoom_ = defaultZoom;
    this.initialZoom_ = initialZoom;
    this.zoomBehavior_ = zoomBehavior;
  }

  static create(streamInfo, zoomBehavior) {
    return Promise
        .all([lookupDefaultZoom(streamInfo), lookupInitialZoom(streamInfo)])
        .then(function(zoomFactors) {
          return new BrowserApi(
              streamInfo, zoomFactors[0], zoomFactors[1], zoomBehavior);
        });
  }

  getStreamInfo() {
    return this.streamInfo_;
  }

  navigateInCurrentTab(url) {
    const tabId = this.getStreamInfo().tabId;

    if (chrome.tabs && tabId !== chrome.tabs.TAB_ID_NONE) {
      chrome.tabs.update(tabId, {url: url});
    }
  }

  setZoom(zoom) {
    assert(
        this.zoomBehavior_ === ZoomBehavior.MANAGE,
        'Viewer does not manage browser zoom.');
    return new Promise((resolve, reject) => {
      chrome.tabs.setZoom(this.streamInfo_.tabId, zoom, resolve);
    });
  }

  getDefaultZoom() {
    return this.defaultZoom_;
  }
  getInitialZoom() {
    return this.initialZoom_;
  }

  getZoomBehavior() {
    return this.zoomBehavior_;
  }

  addZoomEventListener(listener) {
    if (!(this.zoomBehavior_ === ZoomBehavior.MANAGE ||
          this.zoomBehavior_ === ZoomBehavior.PROPAGATE_PARENT)) {
      return;
    }

    chrome.tabs.onZoomChange.addListener(info => {
      const zoomChangeInfo =
         (info);
      if (zoomChangeInfo.tabId !== this.streamInfo_.tabId) {
        return;
      }
      listener(zoomChangeInfo.newZoomFactor);
    });
  }
}

export const ZoomBehavior = {
  NONE: 0,
  MANAGE: 1,
  PROPAGATE_PARENT: 2
};

function createBrowserApiForMimeHandlerView() {
  return new Promise(function(resolve, reject) {
           chrome.mimeHandlerPrivate.getStreamInfo(resolve);
         })
      .then(function(streamInfo) {
        const promises = [];
        let zoomBehavior = ZoomBehavior.NONE;
        if (streamInfo.tabId !== -1) {
          zoomBehavior = streamInfo.embedded ? ZoomBehavior.PROPAGATE_PARENT :
                                               ZoomBehavior.MANAGE;
          promises.push(new Promise(function(resolve) {
                          chrome.tabs.get(streamInfo.tabId, resolve);
                        }).then(function(tab) {
            if (tab) {
              streamInfo.tabUrl = tab.url;
            }
          }));
        }
        if (zoomBehavior === ZoomBehavior.MANAGE) {
          promises.push(new Promise(function(resolve) {
            chrome.tabs.setZoomSettings(
                streamInfo.tabId, {mode: 'manual', scope: 'per-tab'}, resolve);
          }));
        }
        return Promise.all(promises).then(function() {
          return BrowserApi.create(streamInfo, zoomBehavior);
        });
      });
}

function createBrowserApiForPrintPreview() {
  const url = window.location.search.substring(1);
  const streamInfo = {
    streamUrl: url,
    originalUrl: url,
    responseHeaders: {},
    embedded: window.parent !== window,
    tabId:-1,
  };
  return new Promise(function(resolve, reject) {
           if (!chrome.tabs) {
             resolve();
             return;
           }
           chrome.tabs.getCurrent(function(tab) {
             streamInfo.tabId = tab.id;
             streamInfo.tabUrl = tab.url;
             resolve();
           });
         })
      .then(function() {
        return BrowserApi.create(streamInfo, ZoomBehavior.NONE);
      });
}

export function createBrowserApi() {
  if (location.origin === 'chrome://print') {
    return createBrowserApiForPrintPreview();
  }

  return createBrowserApiForMimeHandlerView();
}
