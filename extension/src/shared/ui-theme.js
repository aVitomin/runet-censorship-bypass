'use strict';

(function publishTheme(root, factory) {

  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.rucbTheme = api.createController(root);
  }

})(typeof globalThis === 'object' ? globalThis : this, function() {

  const STORAGE_KEY = 'rucb.ui.theme.v1';
  const THEMES = Object.freeze(['system', 'light', 'dark']);

  function normalize(value) {

    return THEMES.includes(value) ? value : 'system';

  }

  function createController(view) {

    const document = view.document;
    let preference = 'system';

    function apply(value) {

      preference = normalize(value);
      document.documentElement.dataset.uiTheme = preference;
      document.querySelectorAll('[data-ui-theme-control]').forEach((select) => {
        select.value = preference;
      });

    }

    // UI-only storage: never write routing settings or invoke background RPC.
    try {
      apply(view.localStorage.getItem(STORAGE_KEY));
    } catch (_error) {
      apply('system');
    }
    view.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea !== view.localStorage) return;
        apply(view.localStorage.getItem(STORAGE_KEY));
      } catch (_error) {
        // An unavailable preference must not prevent the extension UI opening.
      }
    });

    function setPreference(value) {

      const next = normalize(value);
      apply(next);
      try {
        view.localStorage.setItem(STORAGE_KEY, next);
        return true;
      } catch (_error) {
        return false;
      }

    }

    function mountControl(parent, t) {

      const label = document.createElement('label');
      label.className = 'theme-field';
      const title = document.createElement('span');
      title.textContent = t('uiThemeLabel');
      label.appendChild(title);
      const select = document.createElement('select');
      select.className = 'ui-input';
      select.dataset.uiThemeControl = '';
      select.setAttribute('aria-label', t('uiThemeLabel'));
      for (const theme of THEMES) {
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = t(`uiTheme${theme[0].toUpperCase()}${theme.slice(1)}`);
        select.appendChild(option);
      }
      select.value = preference;
      label.appendChild(select);
      const feedback = document.createElement('span');
      feedback.className = 'theme-feedback';
      feedback.setAttribute('role', 'status');
      label.appendChild(feedback);
      select.addEventListener('change', () => {
        feedback.textContent = setPreference(select.value) ? '' : t('uiThemeSaveFailed');
      });
      parent.appendChild(label);
      return select;

    }

    return Object.freeze({mountControl, setPreference});

  }

  return Object.freeze({STORAGE_KEY, normalize, createController});

});
