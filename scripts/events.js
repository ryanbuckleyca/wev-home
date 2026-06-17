// Events / "Join us" data. Add or edit entries here; set active:false to hide
// one without deleting it. Each entry carries both EN and FR copy so the card
// switches language through the same data-i18n system as the rest of the site.
window.wevEvents = [
  {
    title: 'WISE — Work in the Solidarity Economy',
    title_fr: "WISE — Travailler dans l'économie solidaire",
    type: 'program',
    meta: 'In partnership with SEIZE Concordia · Details coming soon',
    meta_fr: 'En partenariat avec SEIZE Concordia · Détails à venir',
    cta_label: 'Learn about SEIZE',
    cta_label_fr: 'En savoir plus sur SEIZE',
    cta_url: 'https://www.solidarityeconomy.ca/history',
    active: true,
  },
  {
    title: 'Anticapitalist Job Hunt Club',
    title_fr: "Club de recherche d'emploi anticapitaliste",
    type: 'recurring',
    format: 'in-person',
    meta: 'Monthly · Artists, makers, co-op folks & social economy workers welcome',
    meta_fr: 'Mensuel · Artistes, créatifs, coopérateurs et travailleurs de l’économie sociale bienvenus',
    cta_label: 'Drop in',
    cta_label_fr: 'Passer nous voir',
    cta_url: '#',
    active: true,
  },
];

(() => {
  const translations = window.wevTranslations;
  const list = document.getElementById('join-list');
  if (!translations || !translations.en || !translations.fr || !list) return;

  const events = window.wevEvents.filter(event => event.active);
  if (!events.length) return;

  // Display labels for the card kicker, kept here so adding a type/format only
  // means extending these maps (with a graceful fallback to the raw value).
  const typeLabels = {
    en: { program: 'Program', recurring: 'Recurring' },
    fr: { program: 'Programme', recurring: 'Récurrent' },
  };
  const formatLabels = {
    en: { 'in-person': 'In person', online: 'Online' },
    fr: { 'in-person': 'En personne', online: 'En ligne' },
  };
  const newTabSuffix = { en: ', opens in a new tab', fr: ', ouvre dans un nouvel onglet' };

  function buildKicker(locale, event) {
    const parts = [typeLabels[locale][event.type] || event.type];
    if (event.format) parts.push(formatLabels[locale][event.format] || event.format);
    return parts.join(' · ');
  }

  events.forEach((event, index) => {
    const ns = `event${index}`;
    const isExternal = /^https?:\/\//i.test(event.cta_url);

    // Register per-event strings into the shared translation store so the
    // existing applyTranslations() pass handles initial render and language
    // switching for the cards, exactly like the static sections.
    ['en', 'fr'].forEach(locale => {
      const isFr = locale === 'fr';
      const cta = isFr ? event.cta_label_fr : event.cta_label;
      translations[locale].events = translations[locale].events || {};
      translations[locale].events[ns] = {
        kicker: buildKicker(locale, event),
        title: isFr ? event.title_fr : event.title,
        meta: isFr ? event.meta_fr : event.meta,
        cta,
        ctaLabel: isExternal ? `${cta}${newTabSuffix[locale]}` : cta,
      };
    });

    const card = document.createElement('li');
    card.className = 'event-card fade-up';

    const kicker = document.createElement('p');
    kicker.className = 'event-kicker';
    kicker.setAttribute('data-i18n', `events.${ns}.kicker`);
    kicker.textContent = translations.en.events[ns].kicker;

    const title = document.createElement('h3');
    title.className = 'event-title';
    title.setAttribute('data-i18n', `events.${ns}.title`);
    title.textContent = event.title;

    const meta = document.createElement('p');
    meta.className = 'event-meta';
    meta.setAttribute('data-i18n', `events.${ns}.meta`);
    meta.textContent = event.meta;

    const cta = document.createElement('a');
    cta.className = 'btn-primary event-cta';
    cta.href = event.cta_url;
    cta.setAttribute('data-i18n', `events.${ns}.cta`);
    cta.setAttribute('data-i18n-aria-label', `events.${ns}.ctaLabel`);
    cta.setAttribute('aria-label', translations.en.events[ns].ctaLabel);
    cta.textContent = event.cta_label;
    if (isExternal) {
      cta.target = '_blank';
      cta.rel = 'noopener';
    }

    card.append(kicker, title, meta, cta);
    list.append(card);
  });
})();
