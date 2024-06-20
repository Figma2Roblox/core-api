// @ts-check
import eslint from '@eslint/js';
import eslintPluginNoAutofix from 'eslint-plugin-no-autofix';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	eslintPluginNoAutofix,
	eslintPluginPrettierRecommended,
	{
		rules: {
			'prettier/prettier': 'warn',
			'@typescript-eslint/no-floating-promises': [
				'error',
				{ ignoreVoid: true },
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			"no-autofix/prefer-const": "warn",
			"prefer-const": "off",
			"simple-import-sort/exports": "warn",
			"simple-import-sort/imports": "warn",
			"curly": ["warn", "multi-line", "consistent"],
		},
		plugins: {
			'prettier': eslintPluginPrettier,
			'simple-import-sort': eslintPluginSimpleImportSort,
		}
	},
);