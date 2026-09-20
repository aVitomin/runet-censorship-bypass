'use strict';

(function(root, factory) {

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.rucbConfigurationTransferUi = api;

})(typeof globalThis === 'object' ? globalThis : this, function() {

  // The preview captures a Saved revision; confirmation never substitutes a
  // newer revision. Draft ownership stays in the host Options controller.
  function createController(options) {

    const state = {busy: false, preview: null, text: null, message: null, error: null};
    const notify = () => options.changed && options.changed();
    async function run(operation) {

      if (state.busy) return;
      state.busy = true;
      state.error = null;
      state.message = null;
      notify();
      try { return await operation(); } catch (error) {
        state.error = error && error.code || 'TRANSFER_INVALID';
      } finally { state.busy = false; notify(); }

    }
    function requireClean() {

      if (options.hasDraft()) {
        const error = new Error('TRANSFER_DRAFT');
        error.code = 'TRANSFER_DRAFT';
        throw error;
      }

    }
    return {
      state,
      preview: (file) => run(async () => {
        requireClean();
        state.preview = null;
        state.text = null;
        if (!file || file.size > 1024 * 1024) {
          const error = new Error('TRANSFER_LIMIT');
          error.code = 'TRANSFER_LIMIT';
          throw error;
        }
        const text = await file.text();
        const preview = await options.call('preview', {text});
        requireClean();
        state.text = text;
        state.preview = preview;
      }),
      confirm: () => run(async () => {
        requireClean();
        if (!state.preview || state.text === null) return;
        await options.call('import', {text: state.text, expectedRevision: state.preview.expectedRevision});
        state.preview = null;
        state.text = null;
        state.message = 'transferImported';
        await options.onImported();
      }),
      export: (support) => run(async () => {
        const value = await options.call('export', {support});
        await options.download(value, support);
        state.message = 'transferExported';
      }),
      cancel() { state.preview = null; state.text = null; notify(); },
    };

  }

  function mount(parent, options) {

    const document = parent.ownerDocument;
    const t = options.t;
    const model = options.model;
    const add = (tag, text, className) => {
      const node = document.createElement(tag);
      if (text) node.textContent = text;
      if (className) node.className = className;
      parent.appendChild(node);
      return node;
    };
    const button = (label, action) => {
      const node = add('button', t(label), 'ui-button');
      node.type = 'button';
      node.addEventListener('click', action);
      node.disabled = model.state.busy;
      return node;
    };
    function render() {

      parent.replaceChildren();
      if (options.heading !== false) {
        add('h2', t('transferTitle'));
        add('p', t('transferHelp'), 'muted');
      }
      button('transferExport', () => model.export(false));
      button('transferSupport', () => model.export(true));
      add('p', t('transferSupportHelp'), 'muted');
      const label = add('label', t('transferImport'));
      const file = document.createElement('input');
      label.appendChild(file);
      file.type = 'file';
      file.accept = '.json,application/json';
      file.setAttribute('aria-label', t('transferImport'));
      file.disabled = model.state.busy;
      file.addEventListener('change', () => {
        if (file.files[0]) model.preview(file.files[0]);
      });
      const state = model.state;
      if (state.preview) {
        const summary = state.preview.summary;
        add('h3', t('transferPreview'));
        add('p', t('transferCounts', [String(summary.rules), String(summary.rulesChanged),
          String(summary.proxies), String(summary.missing)]));
        if (summary.proxiesChanged) add('p', t('unifiedCategory_proxyConnections'));
        if (summary.routingChanged) add('p', t('unifiedCategory_routingSettings'));
        for (const field of summary.unsupported) add('p', t(`transferUnsupported_${field}`), 'warning');
        add('p', t('transferReplaceWarning'), 'warning');
        button('transferConfirm', () => model.confirm());
        button('transferCancel', () => model.cancel());
      }
      const errors = {TRANSFER_VERSION: 'transferVersion', TRANSFER_LIMIT: 'transferLimit',
        TRANSFER_DRAFT: 'transferDraft', TRANSFER_NO_CONFIGURATION: 'transferNoConfiguration',
        SAVED_REVISION_CHANGED: 'transferConflict', SETTINGS_REVISION_CONFLICT: 'transferConflict',
        STALE_REVISION: 'transferConflict'};
      const status = add('p', state.error ? t(errors[state.error] || 'transferInvalid') :
        state.message ? t(state.message) : '', 'status');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');

    }
    options.bind(render);
    render();

  }

  function download(document, value, support) {

    const view = document.defaultView;
    const url = view.URL.createObjectURL(new view.Blob([JSON.stringify(value, null, 2)], {type: 'application/json'}));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = support ? 'runet-support.json' : 'runet-settings.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    view.setTimeout(() => view.URL.revokeObjectURL(url), 0);

  }

  return Object.freeze({createController, mount, download});

});
