import next from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config. `eslint-config-next/core-web-vitals` (v16) is a native
 * flat-config array bundling the Next base rules, TypeScript rules, and the
 * Core Web Vitals rules. `eslint-config-prettier` turns off any stylistic rules
 * that would fight Prettier. Deep type checking is handled by `tsc --strict`.
 */
const eslintConfig = [
  { ignores: ['.next/**', 'out/**', 'coverage/**', 'node_modules/**', 'next-env.d.ts'] },
  ...next,
  prettier,
];

export default eslintConfig;
