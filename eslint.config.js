/**
 * ESLint: the checks `astro check` does not do.
 *
 * `astro check` covers types and template diagnostics; this covers the rest:
 * unused variables, unreachable code, the small mistakes that survive a build
 * because they are valid TypeScript. It runs on demand, not in the build, so it
 * cannot break a deploy at a bad moment.
 *
 * Deliberately close to the recommended sets rather than a house style. The one
 * project-specific rule is below, and it exists because breaking it breaks the
 * CMS rather than offending anyone's taste.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';

export default [
  /*
    Content is not linted here. MDX needs its own parser, and the one rule worth
    enforcing on it (no `import` statements) is checked by
    scripts/check-content.mjs instead, which needs no dependency and can explain
    itself when it fails.
  */
  {
    /*
      `public/vendor/` is MapLibre's own build output, copied in by
      scripts/sync-vendor.mjs so the worker can be served from a stable URL.
      It is third-party minified code: linting it reports a thousand things
      nobody here can act on, and drowns the gate.
    */
    ignores: [
      'dist/',
      '.astro/',
      /* The adapter's bundled output. Present after any build, so without
         this a `npm run verify` following a build lints 124 errors out of
         code nobody here wrote. */
      '.netlify/',
      'node_modules/',
      'src/content/',
      'public/vendor/',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,

  {
    rules: {
      // `_`-prefixed arguments are a deliberate "unused, and I know it".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      /*
        TypeScript already resolves every identifier, and it knows about types
        and ambient globals (`ImageMetadata`, `Astro`) that this rule does
        not. Left on, it reports them as undefined, which is noise.
      */
      'no-undef': 'off',
    },
  },

  {
    // The build-time scripts are Node, not browser.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        WebSocket: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        document: 'readonly',
        window: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
  },

  /*
    Google Apps Script, under tools/. It is not part of the site and never
    reaches a build: it runs inside the club's spreadsheet, where Google calls
    its entry points and supplies the globals below.

    Linted as a script rather than a module for one reason: only in a script
    does eslint honour an `exported` comment, which is how a function whose
    only caller is Google says so. Left as a module, every entry point reads
    as dead code.
  */
  {
    files: ['tools/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        SpreadsheetApp: 'readonly',
        DriveApp: 'readonly',
        SlidesApp: 'readonly',
        GmailApp: 'readonly',
        MailApp: 'readonly',
        PropertiesService: 'readonly',
        ContentService: 'readonly',
        UrlFetchApp: 'readonly',
        Utilities: 'readonly',
        ScriptApp: 'readonly',
        Logger: 'readonly',
      },
    },
  },

  // Prettier owns formatting; this turns off every rule that would argue.
  prettier,
];
