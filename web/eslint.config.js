import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // eleks-ui is vendored library code (copied from the ELEKS UI package); we don't lint it.
  { ignores: ['dist/', 'src/contract.ts', 'src/jiraContract.ts', 'src/components/eleks-ui/'] },
  ...tseslint.configs.strict,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
