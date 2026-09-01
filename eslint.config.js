/**
 * ESLint — the checks `astro check` does not do.
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
    enforcing on it — no `import` statements — is checked by
    scripts/check-content.mjs instead, which needs no dependency and can explain
    itself when it fails.
  */
  { ignores: ['dist/', '.astro/', 'node_modules/', 'src/content/'] },

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
        and ambient globals — `ImageMetadata`, `Astro` — that this rule does
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

  // Prettier owns formatting; this turns off every rule that would argue.
  prettier,
];
