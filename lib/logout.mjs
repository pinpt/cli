import fs from 'fs';
import c from 'kleur';
import { configFileName } from './util.mjs';

export const logout = async (args, options, argsSpec, commandSpec) => {
	if (args && args[0] === 'logout') {
		if (fs.existsSync(configFileName)) {
			fs.unlinkSync(configFileName);
		}
		console.log(c.bold('Logged out! 👋'));
		process.exit(0);
	}
};
