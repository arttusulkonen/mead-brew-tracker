const fs = require('fs');
const path = require('path');

const langsConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'languages.json'), 'utf8')
);

module.exports = {
  lexers: {
    js: ['JavascriptLexer'],
    jsx: ['JsxLexer'],
    ts: ['JavascriptLexer'],
    tsx: ['JsxLexer'],
    default: ['JavascriptLexer']
  },

  locales: langsConfig.supportedLngs,

  output: 'public/locales/$LOCALE/translation.json',

  input: ['src/**/*.{js,jsx,ts,tsx}'],

  keySeparator: false,
  namespaceSeparator: false,

  func: {
    list: ['t'],
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },

  defaultValue: (lng, ns, key) => {
    if (lng === 'en') {
      return key;
    }
    return '';
  },

  keepRemoved: true,
  createOldCatalogs: false,
  sort: true,
};