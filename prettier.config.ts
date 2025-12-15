import type { Config } from 'prettier';

const config: Config = {
	useTabs: true,
	printWidth: 100,
	plugins: ['@ianvs/prettier-plugin-sort-imports']
};

export default config;
