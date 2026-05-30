const translations = window.wevTranslations;
const { applyTranslations, getTranslation } = window.wevI18n;

const supportedLocales = ['en', 'fr'];
const localeStorageKey = 'wev-home-locale';
const themeStorageKey = 'theme';
const themeSwitchDuration = 300;

function getStoredValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Persistence is progressive enhancement; the UI should still work without storage.
  }
}

function getThemeMediaQuery() {
  if (!window.matchMedia) return null;

  try {
    return window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return null;
  }
}

function listenToMediaQuery(mediaQuery, onChange) {
  if (!mediaQuery) return;

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', onChange);
    return;
  }

  if (mediaQuery.addListener) {
    mediaQuery.addListener(onChange);
  }
}

function getInitialLocale() {
  const params = new URLSearchParams(window.location.search);
  const requestedLocale = params.get('lang');
  const savedLocale = getStoredValue(localeStorageKey);
  const browserLocale = navigator.language && navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';

  if (supportedLocales.includes(requestedLocale)) return requestedLocale;
  if (supportedLocales.includes(savedLocale)) return savedLocale;
  return browserLocale;
}

function createLocaleController({ mobileNavControls, themeControls }) {
  function setLocale(locale, { persist = true, updateUrl = true } = {}) {
    const messages = applyTranslations(locale, translations);
    if (!messages) return;

    themeControls.updateThemeToggleLabel();

    document.querySelectorAll('[data-locale-switcher]').forEach(button => {
      button.dataset.currentLocale = locale;
    });

    if (mobileNavControls.isOpen()) {
      mobileNavControls.setLabel(messages.nav.closeMenu);
    }

    if (persist) setStoredValue(localeStorageKey, locale);

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', locale);
      window.history.replaceState({}, '', url);
    }
  }

  function initLocaleSwitchers() {
    document.querySelectorAll('[data-locale-switcher]').forEach(button => {
      button.addEventListener('click', () => {
        const nextLocale = document.documentElement.lang === 'en' ? 'fr' : 'en';
        setLocale(nextLocale);
      });
    });
  }

  return {
    initLocaleSwitchers,
    setLocale,
  };
}

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function initThemeToggle() {
  const themeToggle = document.querySelector('[data-theme-toggle]');
  let themeSwitchTimeout;

  function updateThemeToggleLabel() {
    if (!themeToggle) return;
    const nextThemeLabelKey = getCurrentTheme() === 'dark' ? 'theme.switchToLight' : 'theme.switchToDark';
    themeToggle.setAttribute('aria-label', getTranslation(document.documentElement.lang, nextThemeLabelKey));
  }

  function setTheme(theme, { persist = true } = {}) {
    const root = document.documentElement;
    if (theme !== 'dark' && theme !== 'light') return;

    root.classList.add('theme-switching');
    void document.body.offsetHeight;
    root.setAttribute('data-theme', theme);
    updateThemeToggleLabel();

    if (persist) {
      setStoredValue(themeStorageKey, theme);
      document.cookie = `theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
    }

    if (themeSwitchTimeout) window.clearTimeout(themeSwitchTimeout);
    themeSwitchTimeout = window.setTimeout(() => {
      root.classList.remove('theme-switching');
      themeSwitchTimeout = undefined;
    }, themeSwitchDuration);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  listenToMediaQuery(getThemeMediaQuery(), event => {
    if (getStoredValue(themeStorageKey)) return;
    setTheme(event.matches ? 'dark' : 'light', { persist: false });
  });

  updateThemeToggleLabel();

  return {
    updateThemeToggleLabel,
  };
}

function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const panel = document.querySelector('.nav-panel');
  const backdrop = document.querySelector('.nav-backdrop');

  if (!toggle || !panel) {
    return { isOpen: () => false, setLabel: () => {} };
  }

  function setOpen(open) {
    panel.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    if (backdrop) {
      backdrop.classList.toggle('open', open);
      backdrop.setAttribute('aria-hidden', String(!open));
    }
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute(
      'aria-label',
      open
        ? getTranslation(document.documentElement.lang, 'nav.closeMenu')
        : getTranslation(document.documentElement.lang, 'nav.openMenu')
    );
  }

  function closeMenu() {
    setOpen(false);
  }

  toggle.addEventListener('click', () => {
    setOpen(!panel.classList.contains('open'));
  });

  if (backdrop) {
    backdrop.addEventListener('mousedown', closeMenu);
  }

  document.addEventListener('mousedown', (event) => {
    if (!panel.classList.contains('open')) return;
    if (panel.contains(event.target) || toggle.contains(event.target)) return;
    closeMenu();
  });

  window.addEventListener(
    'scroll',
    () => {
      if (panel.classList.contains('open')) closeMenu();
    },
    { passive: true }
  );

  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  return {
    isOpen: () => toggle.getAttribute('aria-expanded') === 'true',
    setLabel: label => toggle.setAttribute('aria-label', label),
  };
}

const mobileNavControls = initMobileNav();
const themeControls = initThemeToggle();
const localeControls = createLocaleController({ mobileNavControls, themeControls });

localeControls.initLocaleSwitchers();
localeControls.setLocale(getInitialLocale(), { persist: false, updateUrl: false });

// ── Scroll animations ─────────────────────────────────────
const fadeUps = document.querySelectorAll('.fade-up');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  fadeUps.forEach(el => observer.observe(el));
} else {
  fadeUps.forEach(el => el.classList.add('visible'));
}
