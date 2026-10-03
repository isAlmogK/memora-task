import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'drizzle', 'coverage', 'eslint.config.mjs', 'jest.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Nest modules are classes with only decorators; that's the framework idiom.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  // HTTP response bodies are untyped by nature (supertest's res.body is any); the specs
  // assert on their shape instead. Source code keeps the strict rules.
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  // one-off Node scripts are plain JS outside the TS project: lint them without type info
  { files: ['scripts/**/*.mjs'], ...tseslint.configs.disableTypeChecked },
);
