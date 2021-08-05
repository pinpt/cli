import { getPackageJSON } from './util.mjs';

export const showVersionMessage = (args, options) => {
	if (options.version) {
		const pkg = getPackageJSON();
		console.log(pkg.version);
		process.exit(0);
	}
};
