import CFonts from 'cfonts';
import ora from 'ora';
import execa from 'execa';
import path from 'path';
import os from 'os';
import fs from 'fs';
import got from 'got';
import vm from 'vm';
import prompts from 'prompts';
import terminalLink from 'terminal-link';
import getstream from 'get-stream';
import si from 'systeminformation';
import c from 'kleur';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

export const tick = (message) => {
	var isWin = process.platform === 'win32';
	console.log((isWin ? c.green('√ ') : c.green('✔ ')) + c.bold(message));
};

let _options = null;

export const init = ({ options }) => {
	_options = options;
};

export const debug = (message) => {
	if (_options && _options.debug) {
		console.log(c.gray(`🏴‍☠️  ${message}`));
	}
};

export const error = (message, fail = false) => {
	console.error(c.red('Error: ') + c.bold(message));
	if (fail) {
		process.exit(1);
	}
};

export const getProjectDirectory = async (slug) => {
	let dir = path.resolve(_options.dir);
	if (dir === process.cwd()) {
		dir = path.resolve(path.join(_options.dir, slug));
	}
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	return dir;
};

// execute a child process in the new project directory
export const exec = async (cwd, cmd, msg, silent = false) => {
	debug(`running ${cmd} in ${cwd}`);
	let result = false;
	const spinner = ora({ text: c.magenta(msg), discardStdin: true, interval: 80 });
	spinner.start();
	try {
		result = execa.commandSync(cmd, {
			cwd,
		});
		spinner.succeed(c.bold(msg));
	} catch (error) {
		if (!silent) {
			spinner.fail(error.message);
		}
		result = error;
	}
	return result;
};

export const runningFromYarn = () => {
	return process.env.npm_config_user_agent && process.env.npm_config_user_agent.includes('yarn') === true;
};

export const runningFromNpx = () => {
	return process.env._ && process.env._.includes('npx') === true;
};

export const showBanner = () => {
	CFonts.say('Pinpoint', {
		font: 'tiny',
		colors: ['#3830a3'],
		letterSpacing: 1,
		lineHeight: 1,
		space: true,
		maxLength: '0',
	});
	console.log(' ' + terminalLink(c.bold('https://pinpoint.com'), 'https://pinpoint.com'));
	console.log();
};

let CONFIG = false;

export const configFileName = path.resolve(os.homedir(), '.pinpoint.json');

/**
 * structure for config:
 *
 * "apihost": {
 * 	"userId": {
 * 		"siteIds": [],
 * 		"apikey": {
 * 			"value": "",
 * 			"expires": ""
 * 		}
 *    }
 * }
 *
 */

export const getConfig = () => {
	if (CONFIG) {
		return CONFIG;
	}
	if (fs.existsSync(configFileName)) {
		const o = JSON.parse(fs.readFileSync(configFileName));
		CONFIG = o;
		return CONFIG;
	}
	return null;
};

export const saveAPIKey = (apihost, userId, value, expires, siteIds, email) => {
	if (!apihost) {
		if (fs.existsSync(configFileName)) {
			fs.unlinkSync(configFileName);
		}
		return;
	}
	const c = getConfig() || {};
	const _apiconfig = c[apihost] || {};
	if (value && expires > Date.now()) {
		_apiconfig[userId] = {
			email,
			siteIds,
			apikey: {
				value,
				expires,
			},
		};
	} else {
		if (userId) {
			delete _apiconfig[userId];
		} else {
			delete c[apihost];
		}
	}
	c[apihost] = _apiconfig;
	CONFIG = c;
	fs.writeFileSync(configFileName, JSON.stringify(c, null, 2));
	fs.chmodSync(configFileName, '600');
};

export const selectUser = async (apihost) => {
	const config = getConfig();
	if (config) {
		const _apiconfig = config[apihost];
		if (_apiconfig) {
			const userIds = Object.keys(_apiconfig);
			if (userIds === 1) {
				return userIds[0];
			}
			const user = await prompts(
				{
					type: 'select',
					name: 'value',
					message: 'Please pick the user you want to use:',
					choices: userIds.map((userId) => ({ title: _apiconfig[userId].email, description: userId })),
				},
				{
					onCancel: () => {
						process.exit(0);
					},
				}
			);
			return userIds[user.value];
		}
	}
	error('Your login session has expired or you need to login for the first time', true);
};

export const getAPIKey = (apihost, siteId, _userId) => {
	if (process.env.PINPOINT_API_KEY) {
		return process.env.PINPOINT_API_KEY;
	}
	const config = getConfig();
	if (config) {
		const _configForHost = config[apihost];
		if (_configForHost) {
			const userId =
				_userId ||
				Object.keys(_configForHost).find(
					(userId) => _configForHost[userId].siteIds && _configForHost[userId].siteIds.includes(siteId)
				);
			if (userId) {
				const { value, expires = 0 } = _configForHost[userId].apikey || {};
				const expired = expires <= Date.now();
				if (!expired) {
					// if it expires in the future, return it
					return value;
				}
				debug('need to remove expired api key');
				saveAPIKey(apihost, userId); // remove it since expired
			}
		}
	}
	return null;
};

let IP = false;

const ipAddress = async () => {
	if (IP) {
		return IP;
	}
	IP = await got.get(`https://api.ipify.org?format=json`, { responseType: 'json' }).then((res) => res.body.ip);
	return IP;
};

let MACHINE = false;

const formatManufacturer = (manufacturer) => {
	switch (manufacturer) {
		case 'Apple Inc.': {
			return 'Apple';
		}
		default:
			break;
	}
	return manufacturer;
};

const getSystemInfo = async () => {
	if (MACHINE) {
		return MACHINE;
	}
	MACHINE = si.system().then((data) => `${formatManufacturer(data.manufacturer)} ${data.model}`);
	return MACHINE;
};

const sleep = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

export const apiRequest = async (help, basepath, params = {}) => {
	const {
		body = null,
		method = 'POST',
		quiet = false,
		failOnError = true,
		apiKeyRequired = false,
		apiKey,
		checkSuccess,
		onProgress,
		noSpinner,
	} = params;
	const spinner = ora({ text: quiet ? '' : c.magenta(help), discardStdin: true, interval: 80 });
	if (!noSpinner) {
		spinner.start();
	}
	let _apiKey = apiKey;
	let apihost = _options.host;
	if (apiKeyRequired && !_apiKey) {
		const { apihost: _apihost, siteId } = readPinpointConfig();
		_apiKey = getAPIKey(apihost, siteId);
		if (!_apiKey) {
			error(
				'You are not logged in to this site or your login session has expired. Please login again and try again.',
				true
			);
		}
		apihost = _apihost;
	}
	const headers = {};
	const [ip, machine] = await Promise.all([ipAddress(), getSystemInfo()]);
	if (_apiKey) {
		headers['Authorization'] = `Bearer ${_apiKey}`;
	}
	headers['x-pinpoint-ip'] = ip;
	headers['x-pinpoint-machine'] = machine;
	const url = `https://${apihost}${basepath}`;
	const _method = body ? method : 'GET';
	const isStream = body instanceof FormData;
	const _body = body ? (isStream ? body : JSON.stringify(body)) : undefined;
	if (body && !isStream) {
		headers['Content-Type'] = 'application/json';
	}
	debug(`requesting ${_method} ${url}`);
	try {
		let g;
		let p;
		if (isStream) {
			g = got.stream.post(url, {
				headers,
				responseType: 'json',
				body: _body,
				throwHttpErrors: false,
			});
			if (onProgress) {
				g.on('uploadProgress', onProgress);
			}
			g.resume();
			p = new Promise((resolve, reject) => {
				g.on('response', async (response) => {
					// stream the stream as a response body
					const resp = JSON.parse(await getstream(g));
					const _response = { ...response, body: resp };
					resolve(_response);
				});
				g.on('error', reject);
			});
		} else {
			let count = 0;
			while (true) {
				count++;
				g = got(url, {
					headers,
					method: _method,
					responseType: 'json',
					body: _body,
					throwHttpErrors: false,
				});
				p = await g;
				if (p.statusCode === 502) {
					await sleep(count * Math.max(150, Math.random() * 500)); // exponential backoff
					continue;
				}
				break;
			}
		}
		const res = await p;
		debug(`responded ${_method} ${url} ${JSON.stringify(res.body)}`);
		if (res.body && res.body.success) {
			const [ok, m] = checkSuccess ? checkSuccess(res.body) : [true, help];
			if (ok) {
				if (!quiet) {
					spinner.succeed(c.bold(m));
				}
				return res.body;
			} else {
				spinner.fail(quiet ? '' : m);
				return res.body;
			}
		}
		const message =
			res && res.body && res.body.message
				? res.body.message
				: res.body.error
				? res.body.error
				: 'Internal Server Error';
		if (!quiet) {
			spinner.fail(message);
		}
		if (failOnError) {
			process.exit(1);
		}
		throw new Error(message);
	} catch (err) {
		if (failOnError) {
			spinner.fail(quiet ? '' : err.message);
			process.exit(1);
		} else {
			throw err;
		}
	} finally {
		spinner.stop();
	}
};

export const getPackageJSON = (meta) => {
	const __dirname = path.dirname(fileURLToPath(meta.url));
	const fn = path.join(__dirname, '../package.json');
	if (fs.existsSync(fn)) {
		return JSON.parse(fs.readFileSync(fn));
	}
	return {};
};

export const walkSync = (dir, filter, found = []) => {
	const files = fs.readdirSync(dir);
	files.forEach((file) => {
		const filepath = path.join(dir, file);
		const stats = fs.statSync(filepath);
		if (stats.isDirectory()) {
			if (filter) {
				if (!filter(filepath)) {
					return;
				}
			}
			walkSync(filepath, filter, found);
		} else if (stats.isFile()) {
			if (filter) {
				if (!filter(filepath)) {
					return;
				}
			}
			found.push(filepath);
		}
	});
	return found;
};

let PCONFIG = null;

export const readPinpointConfig = (config) => {
	if (PCONFIG) {
		return PCONFIG;
	}
	const fn = config || path.join(process.cwd(), 'pinpoint.config.js');
	if (fs.existsSync(fn)) {
		const buf = fs.readFileSync(fn);
		const script = new vm.Script(buf.toString(), { filename: fn });
		const context = { module: { exports: {} } };
		script.runInNewContext(context);
		return (PCONFIG = context.module.exports);
	}
	return {};
};
