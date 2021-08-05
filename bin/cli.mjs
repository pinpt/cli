#!/usr/bin/env node

import { run } from '../lib/runner.mjs';
import { error } from '../lib/util.mjs';
import arg from 'arg';

const argsSpec = {
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

const getArgs = () => {
	let OPTIONS = false;
	let ARGS = [];

	const _args = {};
	Object.keys(argsSpec).forEach((key) => {
		const spec = argsSpec[key];
		_args[`--${key}`] = spec.type;
		if (spec.alias) {
			_args[`-${spec.alias}`] = `--${key}`;
		}
	});

	const res = arg(_args, { permissive: true });

	ARGS = res._;
	OPTIONS = {};

	Object.keys(argsSpec).forEach((key) => {
		const spec = argsSpec[key];
		OPTIONS[key] = res[`--${key}`] || res[`-${spec.alias}`] || spec.default;
	});

	// console.log({ OPTIONS, ARGS, _args, res });

	return [OPTIONS, ARGS];
};

(async () => {
	try {
		const [options, args] = getArgs();
		await run(args, options, argsSpec, commandSpec);
	} catch (ex) {
		error(ex.message, true);
	}
})();
