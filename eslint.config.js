// https://docs.expo.dev/guides/using-eslint/
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    ignores: ["dist/*", "node_modules/*"],
  },
];
