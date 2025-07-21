import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const prettierIgnorePath = fileURLToPath(new URL('./.prettierignore', import.meta.url));

export default defineConfig([
	includeIgnoreFile(prettierIgnorePath, 'Imported .prettierignore patterns'),
	{ files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], plugins: { js }, extends: ['js/recommended'] },
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		languageOptions: { globals: globals.browser }
	},
	tseslint.configs.recommended
]);
