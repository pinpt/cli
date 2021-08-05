import { showBanner } from './util.mjs';

export const showWelcomeMessage = (welcome) => {
	showBanner();
	if (welcome) {
		console.log(welcome);
		console.log();
	}
};
