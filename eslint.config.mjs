import js from '@eslint/js';
import html from 'eslint-plugin-html';
import globals from 'globals';

// Lint เฉพาะสคริปต์แอปของเราใน index.html — สคริปต์ SheetJS (vendored, minified)
// ถูกปิดด้วย /* eslint-disable */ ที่ต้นบล็อกในไฟล์ HTML
export default [
  js.configs.recommended,
  {
    files: ['index.html'],
    plugins: { html },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        XLSX: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off',
      eqeqeq: 'off'
    }
  },
  {
    files: ['test/**/*.mjs', '*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  }
];
