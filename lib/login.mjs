import { getSignup } from './signup.mjs';
import { saveAPIKey } from './util.mjs';

export const login = async ({ args }) => {
	if (args && args[0] === 'login') {
		saveAPIKey(); // remove it
		await getSignup('login');
	}
};
