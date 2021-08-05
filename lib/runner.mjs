import { init } from './util.mjs';
import { showHelpMessage } from './show-help-message.mjs';
import { showVersionMessage } from './show-version-message.mjs';
import { showWelcomeMessage } from './show-welcome-message.mjs';
import { login } from './login.mjs';
import { logout } from './logout.mjs';
import { signup } from './signup.mjs';

export const run = async ({ meta, args, options, optionSpec, commandSpec }) => {
	init({ meta, args, options, optionSpec, commandSpec });
	await showVersionMessage({ meta, args, options, optionSpec, commandSpec });
	await showHelpMessage({ meta, args, options, optionSpec, commandSpec });
	await showWelcomeMessage();
	await signup({ meta, args, options, optionSpec, commandSpec });
	await login({ meta, args, options, optionSpec, commandSpec });
	await logout({ meta, args, options, optionSpec, commandSpec });
};
