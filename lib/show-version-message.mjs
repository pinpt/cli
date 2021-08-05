import { getPackageJSON } from './util.mjs';

export const showVersionMessage = ({ meta, options }) => {
	if (options.version) {
		const pkg = getPackageJSON(meta);
		console.log(pkg.version);
		process.exit(0);
	}
};
