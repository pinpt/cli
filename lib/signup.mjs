import prompts from 'prompts';
import c from 'kleur';
import slugify from 'slugify';
import terminalLink from 'terminal-link';
import { getAPIKey, saveConfigProps, saveAPIKey, apiRequest, debug, error, tick, configFileName } from './util.mjs';

const getEmailPrompt = () => {
	return prompts(
		{
			type: 'text',
			name: 'value',
			message: 'What is your email address?',
			validate: (email) => {
				var re =
					/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
				return re.test(email);
			},
		},
		{
			onCancel: () => {
				process.exit(0);
			},
		}
	);
};

const handlePromptFlow = async (email, loginToken, userId, siteId, slug) => {
	console.log();
	console.log(
		c.magenta('We sent you an email at ') + c.magenta(c.bold(email)) + c.magenta(' to verify your account.')
	);
	console.log();
	while (true) {
		const code = await prompts(
			{
				type: 'text',
				name: 'value',
				message: 'Please enter the code from the email:',
				validate: (value) => value.length,
			},
			{
				onCancel: () => {
					process.exit(0);
				},
			}
		);
		try {
			await apiRequest('Verifying the code', '/user/signup/code', {
				body: { email: email, code: code.value, siteId },
				method: 'PUT',
				apiKey: loginToken,
			});
			break;
		} catch (ex) {
			error('Invalid code supplied. Please try again', false);
		}
	}
	const ok = await prompts(
		{
			type: 'confirm',
			name: 'value',
			message: 'Save login information on this machine for 30 days?',
			initial: true,
		},
		{
			onCancel: () => {
				process.exit(0);
			},
		}
	);
	if (ok.value) {
		// save it
		saveAPIKey(loginToken, Date.now() + 2.592e9 - 40000);
		saveConfigProps({ userId, siteId, slug });
		tick(`We saved your cached credentials at ${configFileName}`);
		console.log();
	}
};

const slugifyString = (val) => {
	return slugify(val, { replacement: '-', strict: true, remove: /[*+~.()'"!:@]/g })
		.replace(/-$/, '')
		.replace(/^-/, '');
};

const loginExistingUser = async (email) => {
	try {
		return await apiRequest('Verifying your account', '/user/signup', {
			body: {
				user: { email },
				site: { slug: '' },
				offline: true,
			},
			failOnError: false,
		});
	} catch (ex) {
		if (ex.message.includes('no user found')) {
			return null;
		}
		throw ex;
	}
};

export const getSignup = async (action) => {
	const apikey = getAPIKey();
	if (apikey) {
		try {
			await apiRequest('Verifying your credentials', '/auth/ping', { quiet: true, failOnError: false });
			debug('we already have a valid and unexpired apikey');
			return; // succeeded
		} catch (ex) {
			saveAPIKey(); // delete it
			// ignore if failed, as that means it's not authorized, invalid, etc
		}
	}

	let signup = action === 'signup';
	let login = action === 'login';

	if (!signup && !login) {
		const account = await prompts(
			{
				type: 'confirm',
				name: 'value',
				message: 'Do you already have a Pinpoint account?',
				initial: true,
			},
			{
				onCancel: () => {
					process.exit(0);
				},
			}
		);
		signup = !account.value;
		login = account.value;
	}

	if (login) {
		// we have an account we so we need to login instead of signup
		const email = await getEmailPrompt();
		const res = await loginExistingUser(email.value);
		if (!res) {
			// no user found
			error('No user found using this email address. Perhaps you entered it incorrectly?', true);
		}
		const { userId, sites, slug, siteId, loginToken } = res;
		let _siteId = siteId;
		let _slug = slug;
		if (sites.length > 0) {
			const site = await prompts(
				{
					type: 'select',
					name: 'value',
					message: 'Please pick the site you want to use:',
					choices: sites.map(({ slug, name }) => ({ title: slug, description: name })),
				},
				{
					onCancel: () => {
						process.exit(0);
					},
				}
			);
			_siteId = sites[site.value].id;
			_slug = sites[site.value].slug;
		}
		await handlePromptFlow(email.value, loginToken, userId, _siteId, _slug);
	} else {
		const signup = { user: {}, site: {}, offline: true };
		// new signup flow
		console.log();
		console.log(c.yellow(`There are 3 quick steps to setup your first Pinpoint site:`));
		console.log();
		console.log(c.yellow(` 1. Your name and email`));
		console.log(c.yellow(` 2. Your site name`));
		console.log(c.yellow(` 3. Your site url`));
		console.log();
		console.log(c.magenta(`\nOK, we need some information about you ${c.gray('(You can change this later)')}\n`));
		while (true) {
			const email = await getEmailPrompt();
			signup.user.email = email.value;
			const name = await prompts(
				[
					{
						type: 'text',
						name: 'firstName',
						message: `What's your first name (given name)?`,
						validate: (value) => {
							return value.length;
						},
					},
					{
						type: 'text',
						name: 'lastName',
						message: `What's your last name (family name)?`,
						validate: (value) => {
							return value.length;
						},
					},
				],
				{
					onCancel: () => {
						process.exit(0);
					},
				}
			);
			signup.user.firstName = name.firstName;
			signup.user.lastName = name.lastName;
			console.log(
				c.magenta(
					`\nOK, you need to set your site name which usually is your company name or product name ${c.gray(
						'(You can change this later)'
					)}\n`
				)
			);
			const siteName = await prompts(
				{
					type: 'text',
					name: 'value',
					message: `What's your site's name?`,
					validate: (value) => {
						return value.length;
					},
				},
				{
					onCancel: () => {
						process.exit(0);
					},
				}
			);
			console.log(
				c.magenta(
					`\nOK, now you need to choose your site slug which is the short part of your vanity url at https://[SLUG].changelog.so ${c.gray(
						'(You can change this later)'
					)}\n`
				)
			);
			signup.site.name = siteName.value;
			let initial = slugifyString(siteName.value.toLowerCase());
			let slugValue = '';
			while (true) {
				const siteSlug = await prompts(
					{
						type: 'text',
						name: 'value',
						message: `What's your site's slug?`,
						validate: (value) => {
							return value.length > 0 && value.length < 40;
						},
						initial,
					},
					{
						onCancel: () => {
							process.exit(0);
						},
					}
				);
				const { exists } = await apiRequest('Checking availability...', `/user/site/${siteSlug.value}`, {
					failOnError: false,
					checkSuccess: ({ exists }) =>
						!exists
							? [
									true,
									`Perfect! Your site will be ${c.yellow(
										`https://${siteSlug.value}.changelog.so`
									)} but you can change it or use your own domain`,
							  ]
							: [false, 'Oops! Already taken, please try another one...'],
				});
				if (exists) {
					initial = '';
					continue;
				}
				slugValue = siteSlug.value;
				signup.site.slug = slugValue;
				break;
			}
			console.log();
			console.log(c.yellow(`OK, please confirm the following is correct:`));
			console.log();
			console.log(c.yellow(` Your Name:   ${c.white(c.bold(`${name.firstName} ${name.lastName}`))}`));
			console.log(c.yellow(` Your Email:  ${c.white(c.bold(`${email.value}`))}`));
			console.log(c.yellow(` Your Site:   ${c.white(c.bold(`${siteName.value}`))}`));
			console.log(c.yellow(` Your URL:    ${c.white(c.bold(`https://${slugValue}.changelog.so`))}`));
			console.log();
			const confirm = await prompts(
				{
					type: 'confirm',
					name: 'value',
					message: 'Does this like correct?',
					initial: true,
				},
				{
					onCancel: () => {
						process.exit(0);
					},
				}
			);
			if (confirm.value) {
				break;
			}
		}
		console.log('');
		console.log(
			c.magenta(
				`\nOK, this is it (promise)! We need to make you aware of our ${terminalLink(
					'Privacy Policy',
					'https://pinpoint.com/privacy'
				)} and ${terminalLink('Terms of Service', 'https://pinpoint.com/terms')}`
			)
		);
		console.log('');
		const agree = await prompts(
			{
				type: 'toggle',
				name: 'value',
				initial: true,
				active: 'yes',
				inactive: 'no',
				message: 'Please confirm you agree?',
				initial: true,
			},
			{
				onCancel: () => {
					process.exit(0);
				},
			}
		);
		if (!agree.value) {
			console.log(
				c.red(
					`Cancelled, let us know if you have concerns or need assistance at ${terminalLink(
						'support@pinpoint.com',
						'support@pinpoint.com'
					)}`
				)
			);
			process.exit(1);
		}
		console.log();
		const res = await apiRequest('Creating your account', '/user/signup', {
			body: signup,
		});
		const { userId, slug, siteId, loginToken } = res;
		await handlePromptFlow(signup.user.email, loginToken, userId, siteId, slug);
		console.log();
		console.log(c.bold(c.green('🚀 Your account is activated!')));
		console.log();
	}
};

export const signup = async (args, options, argsSpec, commandSpec) => {
	if (args && args[0] === 'signup') {
		await getSignup('signup');
	}
};
