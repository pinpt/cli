import { getSignup } from './signup.mjs';

export const login = async ({ args }) => {
	if (args && args[0] === 'login') {
		await getSignup('login');
	}
};
