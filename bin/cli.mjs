#!/usr/bin/env node

import { run } from '../lib/runner.mjs';
import { error } from '../lib/util.mjs';
import { getArgs } from '../lib/args.mjs';

const optionSpec = {
	help: { type: Boolean, description: 'This menu :/', alias: 'h', default: false },
	version: { type: Boolean, description: 'Print the version and exit', alias: 'v', default: false },
	host: { type: String, description: 'The api host', hidden: true, default: 'api.pinpoint.com' },
	'dry-run': { type: Boolean, description: `Run the command but don't actually do anything`, default: false },
	debug: { type: Boolean, description: 'Turn on verbose debug logging', default: false },
};

const commandSpec = {
	deploy: { description: 'Deploy the site to Pinpoint' },
	login: { description: 'Login to Pinpoint' },
	logout: { description: 'Logout of Pinpoint on this machine' },
	signup: { description: 'Signup for Pinpoint' },
};

(async () => {
	try {
		const [options, args] = getArgs(optionSpec);
		await run({ args, options, optionSpec, commandSpec, meta: import.meta });
	} catch (ex) {
		error(ex.message, true);
	}
})();
