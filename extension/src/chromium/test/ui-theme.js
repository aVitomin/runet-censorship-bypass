'use strict';

const Assert = require('node:assert/strict');
const Theme = require('../../shared/ui-theme');

function harness(initial = null, blocked = false) {

  const writes = [];
  const listeners = {};
  const document = {
    documentElement: {dataset: {}},
    querySelectorAll: () => [],
  };
  let value = initial;
  const storage = {
    getItem(key) {
      Assert.equal(key, Theme.STORAGE_KEY);
      if (blocked) throw new Error('Storage disabled');
      return value;
    },
    setItem(key, next) {
      if (blocked) throw new Error('Storage disabled');
      writes.push([key, next]);
      value = next;
    },
  };
  const controller = Theme.createController({document, localStorage: storage,
    addEventListener: (name, listener) => {
      listeners[name] = listener;
    }});
  return {document, controller, writes, storage, listeners,
    external(next) {
      value = next;
    },
  };

}

describe('Shared appearance preferences', function() {
  it('loads a saved theme without writing settings or needing background APIs', function() {
    const page = harness('dark');
    Assert.equal(page.document.documentElement.dataset.uiTheme, 'dark');
    Assert.deepEqual(page.writes, []);
    Assert.equal(page.controller.setPreference('light'), true);
    Assert.deepEqual(page.writes, [[Theme.STORAGE_KEY, 'light']]);
  });

  it('uses system appearance for missing or invalid values', function() {
    for (const value of [null, '', {}, 'unexpected', 'DARK']) {
      const page = harness(value);
      Assert.equal(page.document.documentElement.dataset.uiTheme, 'system');
      Assert.deepEqual(page.writes, []);
    }
  });

  it('keeps the page usable and reports that a selection could not be saved', function() {
    const page = harness(null, true);
    Assert.equal(page.controller.setPreference('dark'), false);
    Assert.equal(page.document.documentElement.dataset.uiTheme, 'dark');
    Assert.deepEqual(page.writes, []);
  });

  it('synchronizes other extension pages without echo writes or unrelated storage', function() {
    const page = harness('light');
    page.external('dark');
    page.listeners.storage({key: 'routing', storageArea: page.storage});
    Assert.equal(page.document.documentElement.dataset.uiTheme, 'light');
    page.listeners.storage({key: Theme.STORAGE_KEY, storageArea: {}});
    Assert.equal(page.document.documentElement.dataset.uiTheme, 'light');
    page.listeners.storage({key: Theme.STORAGE_KEY, storageArea: page.storage});
    Assert.equal(page.document.documentElement.dataset.uiTheme, 'dark');
    page.external(null);
    page.listeners.storage({key: null, storageArea: page.storage});
    Assert.equal(page.document.documentElement.dataset.uiTheme, 'system');
    Assert.deepEqual(page.writes, []);
  });
});
