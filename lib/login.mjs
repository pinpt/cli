import { getSignup } from './signup.mjs';
import { saveAPIKey } from './util.mjs';

export const login = async ({ args, options }) => {
	if (args && args[0] === 'login') {
		await getSignup('login', options.host);
	}
};
