import './pdf_viewer_wrapper.js';

import {BrowserApi, createBrowserApi} from './browser_api.js';

const pendingMessages = [];

function handleScriptingMessage(message) {
  pendingMessages.push(message);
}

function initViewer(browserApi) {

  window.removeEventListener('message', handleScriptingMessage, false);
  const viewer = document.querySelector('#viewer');
  viewer.init(browserApi);
  while (pendingMessages.length > 0) {
    viewer.handleScriptingMessage(pendingMessages.shift());
  }
  window.viewer = viewer;
}

function configureJavaScriptContentSetting(browserApi) {
  return new Promise((resolve, reject) => {
    chrome.contentSettings.javascript.get(
        {
          'primaryUrl': browserApi.getStreamInfo().originalUrl,
          'secondaryUrl': window.location.origin
        },
        (result) => {
          browserApi.getStreamInfo().javascript = result.setting;
          resolve(browserApi);
        });
  });
}

function main() {
  
  window.addEventListener('message', handleScriptingMessage, false);
  let chain = createBrowserApi();
  if (chrome.contentSettings) {
    chain = chain.then(configureJavaScriptContentSetting);
  }

  chain.then(initViewer);
}

main();



