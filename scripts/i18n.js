window.wevI18n = (() => {
  const translatedAttributes = [
    ['aria-label', 'data-i18n-aria-label'],
    ['alt', 'data-i18n-alt'],
  ];

  function getTranslation(locale, key, translations = window.wevTranslations) {
    return key.split('.').reduce((value, part) => value && value[part], translations[locale]);
  }

  function applyTextTranslations(locale) {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const value = getTranslation(locale, element.getAttribute('data-i18n'));
      if (value) element.textContent = value;
    });
  }

  function applyHtmlTranslations(locale) {
    document.querySelectorAll('[data-i18n-html]').forEach(element => {
      const value = getTranslation(locale, element.getAttribute('data-i18n-html'));
      if (value) element.innerHTML = value;
    });
  }

  function applyAttributeTranslations(locale) {
    translatedAttributes.forEach(([attribute, dataAttribute]) => {
      document.querySelectorAll(`[${dataAttribute}]`).forEach(element => {
        const value = getTranslation(locale, element.getAttribute(dataAttribute));
        if (value) element.setAttribute(attribute, value);
      });
    });
  }

  function applyMetaTranslations(messages) {
    document.title = messages.meta.title;
    document.querySelector('meta[name="description"]').setAttribute('content', messages.meta.description);
    document.querySelector('meta[property="og:title"]').setAttribute('content', messages.meta.ogTitle);
    document
      .querySelector('meta[property="og:description"]')
      .setAttribute('content', messages.meta.ogDescription);
  }

  function applyTranslations(locale, translations = window.wevTranslations) {
    const messages = translations[locale];
    if (!messages) return undefined;

    document.documentElement.lang = locale;
    applyMetaTranslations(messages);
    applyTextTranslations(locale);
    applyHtmlTranslations(locale);
    applyAttributeTranslations(locale);

    return messages;
  }

  return {
    applyTranslations,
    getTranslation,
  };
})();
