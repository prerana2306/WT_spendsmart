/**
 * SpendSmart Theme Manager
 * Supports Light, Dark, and System Default themes.
 * Persists selection in localStorage and responds dynamically to OS preferences.
 */

(function () {
  const THEME_KEY = 'spendsmart_theme';

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme) {
    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = getSystemTheme();
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.body && document.body.setAttribute('data-theme', effectiveTheme);

    // Update theme switcher UI icons if present
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', effectiveTheme === 'dark' ? 'sun' : 'moon');
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'system';
    applyTheme(savedTheme);

    // Listen to OS system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const currentSaved = localStorage.getItem(THEME_KEY) || 'system';
        if (currentSaved === 'system') {
          applyTheme('system');
        }
      });
    }
  }

  window.setTheme = function (theme) {
    if (!['light', 'dark', 'system'].includes(theme)) return;
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  };

  window.toggleTheme = function () {
    const currentTheme = localStorage.getItem(THEME_KEY) || 'system';
    let nextTheme = 'dark';
    if (currentTheme === 'dark') nextTheme = 'light';
    else if (currentTheme === 'light') nextTheme = 'system';
    else nextTheme = 'dark';

    window.setTheme(nextTheme);
    if (window.showToast) {
      window.showToast(`Theme switched to ${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)}`, 'info');
    }
  };

  window.getCurrentTheme = function () {
    return localStorage.getItem(THEME_KEY) || 'system';
  };

  // Run on page load
  initTheme();
  document.addEventListener('DOMContentLoaded', initTheme);
})();
