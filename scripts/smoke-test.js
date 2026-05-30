const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scriptPaths = [
  path.join(root, 'scripts/translations.js'),
  path.join(root, 'scripts/i18n.js'),
  path.join(root, 'scripts/main.js'),
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function createPage(url = 'https://wevchange.org/') {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', message => errors.push(message));

  function addBrowserMocks(window) {
    window.matchMedia = query => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    });
  }

  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse: addBrowserMocks,
  });

  scriptPaths.forEach(scriptPath => {
    dom.window.eval(fs.readFileSync(scriptPath, 'utf8'));
  });

  if (errors.length) {
    fail(`Console/runtime errors:\n${errors.join('\n')}`);
  }

  return dom;
}

function click(element) {
  element.dispatchEvent(new element.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
}

function testInitialLoad() {
  const dom = createPage();
  const { document } = dom.window;

  assert(document.documentElement.lang === 'en', 'Expected English as the default locale.');
  assert(document.querySelector('.hero-headline').textContent.includes('better world'), 'Hero copy did not render.');
  assert(document.querySelector('[data-theme-toggle]').getAttribute('aria-label') === 'Switch to light mode', 'Theme label did not initialize from system preference.');
}

function testLanguageToggle() {
  const dom = createPage();
  const { document, localStorage, location } = dom.window;

  click(document.querySelector('[data-locale-switcher]'));

  assert(document.documentElement.lang === 'fr', 'Language toggle did not switch to French.');
  assert(document.querySelector('[data-locale-switcher]').dataset.currentLocale === 'fr', 'Language switcher state did not update.');
  assert(location.search === '?lang=fr', 'Language toggle did not update the URL.');
  assert(localStorage.getItem('wev-home-locale') === 'fr', 'Language preference was not persisted.');
  assert(
    document.querySelector('.nav-panel-contact').textContent === 'Nous joindre',
    'Nav contact link did not translate.',
  );
}

function testThemeToggle() {
  const dom = createPage();
  const { document, localStorage } = dom.window;

  click(document.querySelector('[data-theme-toggle]'));

  assert(document.documentElement.getAttribute('data-theme') === 'light', 'Theme toggle did not switch themes.');
  assert(localStorage.getItem('theme') === 'light', 'Theme preference was not persisted.');
  assert(document.cookie.includes('theme=light'), 'Theme cookie was not written.');
}

function testMobileNav() {
  const dom = createPage();
  const { document } = dom.window;
  const toggle = document.querySelector('.nav-toggle');
  const panel = document.querySelector('.nav-panel');
  const backdrop = document.querySelector('.nav-backdrop');

  click(toggle);
  assert(toggle.getAttribute('aria-expanded') === 'true', 'Mobile nav did not open.');
  assert(panel.classList.contains('open'), 'Mobile nav panel did not receive open class.');
  assert(backdrop.classList.contains('open'), 'Mobile nav backdrop did not receive open class.');

  click(panel.querySelector('a[href="#about"]'));
  assert(toggle.getAttribute('aria-expanded') === 'false', 'Mobile nav did not close after link click.');
  assert(!panel.classList.contains('open'), 'Mobile nav panel stayed open after link click.');

  click(toggle);
  assert(panel.classList.contains('open'), 'Mobile nav panel did not reopen.');

  backdrop.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
  assert(!panel.classList.contains('open'), 'Mobile nav did not close after backdrop click.');

  click(toggle);
  dom.window.dispatchEvent(new dom.window.Event('scroll'));
  assert(!panel.classList.contains('open'), 'Mobile nav did not close after scroll.');
}

function run(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

run('initial page load', testInitialLoad);
run('language toggle', testLanguageToggle);
run('theme toggle', testThemeToggle);
run('mobile nav toggle', testMobileNav);

if (process.exitCode) process.exit(process.exitCode);
