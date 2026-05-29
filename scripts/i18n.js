window.wevI18n = (() => {
  const translatedAttributes = [
    ['aria-label', 'data-i18n-aria-label'],
    ['alt', 'data-i18n-alt'],
  ];
  const allowedHtmlTags = new Set(['A', 'SPAN', 'STRONG']);
  const allowedSpanClasses = new Set(['accent', 'teal', 'lavender']);

  function getTranslation(locale, key, translations = window.wevTranslations) {
    return key.split('.').reduce((value, part) => value && value[part], translations[locale]);
  }

  function sanitizeTranslatedHtml(value) {
    const template = document.createElement('template');
    template.innerHTML = value;

    function sanitizeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
      if (node.nodeType !== Node.ELEMENT_NODE || !allowedHtmlTags.has(node.tagName)) {
        return document.createTextNode(node.textContent || '');
      }

      const clone = document.createElement(node.tagName.toLowerCase());

      if (node.tagName === 'SPAN') {
        const allowedClasses = node.className
          .split(/\s+/)
          .filter(className => allowedSpanClasses.has(className));
        if (allowedClasses.length) clone.className = allowedClasses.join(' ');
      }

      if (node.tagName === 'A') {
        const href = node.getAttribute('href') || '';
        if (href.startsWith('mailto:')) clone.setAttribute('href', href);
      }

      node.childNodes.forEach(child => clone.append(sanitizeNode(child)));
      return clone;
    }

    const fragment = document.createDocumentFragment();
    template.content.childNodes.forEach(node => fragment.append(sanitizeNode(node)));
    return fragment;
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
      if (value) element.replaceChildren(sanitizeTranslatedHtml(value));
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
