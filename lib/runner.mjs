import { init } from './util.mjs';
import { showHelpMessage } from './show-help-message.mjs';
import { showVersionMessage } from './show-version-message.mjs';
import { login } from './login.mjs';
import { logout } from './logout.mjs';
import { signup } from './signup.mjs';

export const run = async (args, options, argSpec, commandSpec) => {
	init(args, options, argSpec);
	await showHelpMessage(args, options, argSpec, commandSpec);
	await showVersionMessage(args, options, argSpec, commandSpec);
	await signup(args, options, argSpec, commandSpec);
	await login(args, options, argSpec, commandSpec);
	await logout(args, options, argSpec, commandSpec);
};
