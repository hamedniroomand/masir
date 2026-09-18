import antfu from '@antfu/eslint-config';

export default antfu({
  ignores: ['docs/**', 'drizzle/**'],
  stylistic: {
    semi: true,
  },
}, {
  rules: {
    // AGENTS.md asks for types over interfaces. The antfu preset defaults the
    // other way, so the linter would refuse every type alias in the codebase.
    'ts/consistent-type-definitions': ['error', 'type'],
    'style/quote-props': ['error', 'as-needed'],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'object-shorthand': ['error', 'always'],
    'prefer-const': 'error',
    'prefer-template': 'error',
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'error',
    'import/no-duplicates': ['error', { 'prefer-inline': false }],
    'id-length': ['error', {
      min: 3,
      properties: 'never',
      // Domain abbreviations that are clearer than the long form.
      exceptions: ['_', 'h', 'i', 'j', 'k', 'v', 'id', 'to', 'of', 'in', 'fn', 'on', 'el', 'ok', 'db', 'tx', 'ua', 'ip', 'qr', 'rl', 'sql', 'a', 'b', 'x', 'y'],
    }],
  },
}, {
  files: ['app/**/*.{ts,vue}'],
  ignores: ['app/pages/login.vue', 'app/pages/register.vue', 'app/pages/forgot-password.vue', 'app/pages/reset-password.vue', 'app/pages/verify-email.vue', 'app/pages/report.vue', 'app/pages/p/**', 'app/components/VerifyEmailNotice.vue', 'app/composables/useSignOut.ts', 'app/plugins/api.ts', 'app/composables/useApi.ts'],
  rules: {
    // A signed-in call goes through the api plugin so a 401 sends the user to
    // sign in. Public and auth pages keep the plain fetch on purpose.
    'no-restricted-globals': ['error', { name: 'useFetch', message: 'Use useApi so a 401 redirects to login.' }, { name: '$fetch', message: 'Use useNuxtApp().$api so a 401 redirects to login.' }],
  },
}, {
  files: ['scripts/**/*.ts'],
  rules: {
    // A command line script reports its result on stdout.
    'no-console': 'off',
  },
}, {
  files: ['test/**/*.ts'],
  rules: {
    // A test asserts on a value it just seeded. A missing one must throw, and
    // the short names below belong to the assertion, not to the product.
    'ts/no-non-null-assertion': 'off',
    'id-length': 'off',
  },
}, {
  files: ['**/*.d.ts'],
  rules: {
    // A module augmentation merges into a third-party declaration, and only an
    // interface merges.
    'ts/consistent-type-definitions': 'off',
  },
}, {
  files: ['server/**/*.ts'],
  rules: {
    'ts/ban-ts-comment': 'off',
  },
});
