import CFonts from 'cfonts';
import ora from 'ora';
import execa from 'execa';
import path from 'path';
import os from 'os';
import fs from 'fs';
import got from 'got';
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
	const dir = path.resolve(path.join(_options.dir, slug));
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

export const saveAPIKey = (value, expires) => {
	const c = getConfig() || {};
	if (value && expires > Date.now()) {
		c.apikey = { value, expires };
	} else {
		delete c.apikey; // delete it
	}
	CONFIG = c;
	fs.writeFileSync(configFileName, JSON.stringify(c, null, 2));
	fs.chmodSync(configFileName, '600');
};

export const getConfigProp = (key) => {
	const c = getConfig() || {};
	return c[key];
};

export const saveConfigProps = (props) => {
	const c = { ...(getConfig() || {}), ...props };
	CONFIG = c;
	fs.writeFileSync(configFileName, JSON.stringify(c, null, 2));
	fs.chmodSync(configFileName, '600');
};

export const getAPIKey = () => {
	const config = getConfig();
	if (config && config.apikey) {
		const { value, expires } = config.apikey;
		const expired = expires <= Date.now();
		if (!expired) {
			// if it expires in the future, return it
			return value;
		}
		debug('need to remove expired api key');
		saveAPIKey(); // remove it since expired
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

export const apiRequest = async (help, basepath, params) => {
	const {
		body = null,
		method = 'POST',
		quiet = false,
		failOnError = true,
		apiKey,
		checkSuccess,
		onProgress,
		noSpinner,
	} = params;
	const spinner = ora({ text: quiet ? '' : c.magenta(help), discardStdin: true, interval: 80 });
	if (!noSpinner) {
		spinner.start();
	}
	const _apiKey = apiKey || getAPIKey();
	const headers = {};
	const [ip, machine] = await Promise.all([ipAddress(), getSystemInfo()]);
	if (_apiKey) {
		headers['Authorization'] = `Bearer ${_apiKey}`;
	}
	headers['x-pinpoint-ip'] = ip;
	headers['x-pinpoint-machine'] = machine;
	const url = `https://${_options.host}${basepath}`;
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
			g = got(url, {
				headers,
				method: _method,
				responseType: 'json',
				body: _body,
				throwHttpErrors: false,
			});
			p = g;
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
		const message = res.body && res.body.message ? res.body.message : 'Internal Server Error';
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
