import antfu from '@antfu/eslint-config';

export default antfu({
  ignores: ['docs/**'],
  stylistic: {
    semi: true,
  },
}, {
  files: ['server/**/*.ts'],
  rules: {
    'ts/ban-ts-comment': 'off',
  },
});
