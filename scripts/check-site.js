const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const scriptsPath = path.join(root, 'scripts');
const translationsPath = path.join(scriptsPath, 'translations.js');

const htmlTranslationAttributes = [
  'data-i18n',
  'data-i18n-html',
  'data-i18n-alt',
  'data-i18n-aria-label',
];

const allowedHtmlTranslationKeys = new Set([
  'hero.headline',
  'about.heading',
  'about.body',
  'values.heading',
  'join.heading',
  'contact.emailNote',
]);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fail(message) {
  throw new Error(message);
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

function flattenKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    flattenKeys(nestedValue, prefix ? `${prefix}.${key}` : key),
  );
}

function getPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, part) => current && current[part], value);
}

function loadTranslations() {
  const sandbox = { window: {} };
  vm.runInNewContext(read(translationsPath), sandbox, { filename: translationsPath });

  if (!sandbox.window.wevTranslations) {
    fail('scripts/translations.js did not define window.wevTranslations.');
  }

  return sandbox.window.wevTranslations;
}

function getReferencedTranslationKeys(html, scriptSources) {
  const keys = new Set();
  const source = `${html}\n${scriptSources.join('\n')}`;

  for (const attribute of htmlTranslationAttributes) {
    const pattern = new RegExp(`${attribute}="([^"]+)"`, 'g');
    for (const match of html.matchAll(pattern)) {
      keys.add(match[1]);
    }
  }

  for (const match of source.matchAll(/getTranslation\([^,]+,\s*['"]([^'"]+)['"]\)/g)) {
    keys.add(match[1]);
  }

  for (const match of source.matchAll(/messages\.meta\.([a-zA-Z0-9_]+)/g)) {
    keys.add(`meta.${match[1]}`);
  }

  if (html.includes('data-i18n-theme-label')) {
    keys.add('theme.switchToLight');
    keys.add('theme.switchToDark');
  }

  return keys;
}

function checkTranslationParity(translations) {
  const locales = Object.keys(translations);
  if (locales.length < 2) fail('Expected at least two locales.');

  const [baseLocale, ...otherLocales] = locales;
  const baseKeys = flattenKeys(translations[baseLocale]).sort();

  for (const locale of otherLocales) {
    const localeKeys = flattenKeys(translations[locale]).sort();
    const missing = baseKeys.filter(key => !localeKeys.includes(key));
    const extra = localeKeys.filter(key => !baseKeys.includes(key));

    if (missing.length || extra.length) {
      fail(
        [
          `${locale} does not match ${baseLocale} translation keys.`,
          missing.length ? `Missing: ${missing.join(', ')}` : '',
          extra.length ? `Extra: ${extra.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
  }
}

function checkTranslationUsage(translations, html, scriptSources) {
  const referencedKeys = getReferencedTranslationKeys(html, scriptSources);
  const localeKeys = Object.fromEntries(
    Object.entries(translations).map(([locale, messages]) => [
      locale,
      new Set(flattenKeys(messages)),
    ]),
  );
  const allKnownKeys = new Set(Object.values(localeKeys).flatMap(keys => [...keys]));
  const unusedKeys = [...allKnownKeys].filter(key => !referencedKeys.has(key));
  const missingKeys = [...referencedKeys].filter(key =>
    Object.values(localeKeys).some(keys => !keys.has(key)),
  );

  if (unusedKeys.length) {
    fail(`Unused translation keys: ${unusedKeys.sort().join(', ')}`);
  }

  if (missingKeys.length) {
    fail(`Referenced translation keys are missing: ${missingKeys.sort().join(', ')}`);
  }
}

function checkTranslationValues(translations) {
  for (const [locale, messages] of Object.entries(translations)) {
    for (const key of flattenKeys(messages)) {
      const value = getPath(messages, key);

      if (typeof value !== 'string') {
        fail(`${locale}.${key} must be a string.`);
      }

      if (!value.trim()) {
        fail(`${locale}.${key} is empty.`);
      }

      if (/[<>]/.test(value) && !allowedHtmlTranslationKeys.has(key)) {
        fail(`${locale}.${key} contains HTML but is not whitelisted.`);
      }
    }
  }
}

function checkHtmlValidation() {
  const binary = process.platform === 'win32' ? 'html-validate.cmd' : 'html-validate';

  childProcess.execFileSync(binary, ['index.html'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkJavaScriptSyntax() {
  fs.readdirSync(scriptsPath)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      childProcess.execFileSync(process.execPath, ['--check', path.join(scriptsPath, file)], {
        cwd: root,
        stdio: 'inherit',
      });
    });

  const html = read(indexPath);
  const inlineScripts = [];
  let cursor = 0;

  while (true) {
    const start = html.indexOf('<script>', cursor);
    if (start === -1) break;

    const contentStart = start + '<script>'.length;
    const end = html.indexOf('</script>', contentStart);
    if (end === -1) fail('Found an inline <script> without a closing tag.');

    inlineScripts.push(html.slice(contentStart, end));
    cursor = end + '</script>'.length;
  }

  const inlinePath = path.join(root, '.tmp-inline-scripts.js');
  fs.writeFileSync(inlinePath, inlineScripts.join('\n;\n'));

  try {
    childProcess.execFileSync(process.execPath, ['--check', inlinePath], {
      cwd: root,
      stdio: 'inherit',
    });
  } finally {
    fs.rmSync(inlinePath, { force: true });
  }
}

function stripAssetQuery(value) {
  return value.split(/[?#]/, 1)[0];
}

function checkAssetReferences(html) {
  const assetAttributes = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  const missing = assetAttributes
    .filter(value => {
      if (
        value.startsWith('#') ||
        value.startsWith('mailto:') ||
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('data:')
      ) {
        return false;
      }

      return !fs.existsSync(path.join(root, stripAssetQuery(value)));
    })
    .sort();

  if (missing.length) {
    fail(`Missing referenced assets: ${missing.join(', ')}`);
  }
}

function checkAnchorReferences(html) {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]));
  const missing = [...html.matchAll(/\shref="#([^"]*)"/g)]
    .map(match => match[1])
    .filter(anchor => anchor && !ids.has(anchor))
    .sort();

  if (missing.length) {
    fail(`Missing anchor targets: ${missing.join(', ')}`);
  }
}

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);

    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    if (entry.isDirectory()) return walkFiles(entryPath);
    return [entryPath];
  });
}

function checkNoJunkFiles() {
  const junkFiles = walkFiles(root)
    .filter(file => path.basename(file) === '.DS_Store')
    .map(file => path.relative(root, file));

  if (junkFiles.length) {
    fail(`Junk files found: ${junkFiles.join(', ')}`);
  }
}

const html = read(indexPath);
const scriptSources = fs
  .readdirSync(scriptsPath)
  .filter(file => file.endsWith('.js'))
  .map(file => read(path.join(scriptsPath, file)));
const translations = loadTranslations();

run('translation key parity', () => checkTranslationParity(translations));
run('translation usage coverage', () => checkTranslationUsage(translations, html, scriptSources));
run('translation values', () => checkTranslationValues(translations));
run('HTML validation', checkHtmlValidation);
run('JavaScript syntax', checkJavaScriptSyntax);
run('asset references', () => checkAssetReferences(html));
run('anchor references', () => checkAnchorReferences(html));
run('no junk files', checkNoJunkFiles);

if (process.exitCode) process.exit(process.exitCode);
