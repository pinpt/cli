import prompts from 'prompts';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import AdmZip from 'adm-zip';
import tmp from 'tmp';
import picomatch from 'picomatch';
import ora from 'ora';
import c from 'kleur';
import progress from 'cli-progress';
import terminalLink from 'terminal-link';
import { debug, error, walkSync, apiRequest, readPinpointConfig, tick } from './util.mjs';

const createMatcher = (buf) => {
	const tok = buf.toString().trim().split(/\n/);
	const matchers = tok.filter(Boolean).map((c) => picomatch(c, { posixSlashes: true }));
	return (filepath) => {
		for (let c = 0; c < matchers.length; c++) {
			if (matchers[c](filepath)) {
				// console.log('MATCH ->', filepath);
				return true;
			}
		}
		// console.log('NOT MATCH ->', filepath);
		return false;
	};
};

// none of these files we actually need to build the app for deployment or to run it
const builtIns = createMatcher(`
node_modules/**
.git/**
.github/**
.next/**
.gitignore
.npmignore
.dockerignore
.prettierignore
.pinpointignore
README*
LICENSE*
prettier.config.js
**/*.zip
**/*.tar
**/*.gzip
`);

const createFilter = (basedir, matcher) => (filepath) => {
	const fn = path.relative(basedir, filepath);
	if (matcher) {
		if (matcher(fn)) {
			return false;
		}
	}
	// console.log('->', fn, builtIns(fn) == false);
	return builtIns(fn) === false;
};

// the minimum size in bytes before we show a progress bar
const minSizeToShowProgressBar = 1024 * 1024;

const confirmPrompt = () => {
	return prompts(
		{
			type: 'confirm',
			name: 'value',
			message: 'Confirm you want to deploy site?',
			initial: true,
		},
		{
			onCancel: () => {
				process.exit(0);
			},
		}
	);
};

const upload = async (fn, config) => {
	const { siteId, slug, apihost } = readPinpointConfig(config);
	if (!siteId) {
		throw new Error(`No required siteId variable found in ${config}`);
	}

	// if we're using an api key or in CI skip the deployment
	if (!process.env.PINPOINT_API_KEY && !process.env.CI) {
		const ok = await confirmPrompt();
		if (!ok.value) {
			console.log(c.red('ｘ') + c.bold(' Cancelled'));
			process.exit(0);
		}
	}

	const showProgress = fs.statSync(fn).size > minSizeToShowProgressBar;

	const p = showProgress
		? new progress.SingleBar({
				format: '' + c.green('{bar}') + ' {percentage}% || {value}/{total} Chunks',
				barCompleteChar: '\u2588',
				barIncompleteChar: '\u2591',
				hideCursor: true,
				clearOnComplete: true,
		  })
		: undefined;

	if (p) {
		p.start(100, 0);
	}

	const spinner = ora({ text: 'Validating ... ', discardStdin: true, interval: 80 });
	if (!p) {
		spinner.start();
	}

	const body = new FormData();
	body.append('upload', fs.createReadStream(fn));

	const { id } = await apiRequest('', `/site/${siteId}/upload`, {
		noSpinner: true,
		method: 'POST',
		body,
		onProgress: (progress) => {
			if (p) {
				p.update(100 * progress.percent);
				if (progress.percent === 1) {
					p.stop();
					spinner.start();
				}
			}
		},
	});

	const baseUrl = (apihost || '').includes('edge') ? 'https://home.edge.pinpoint.com' : 'https://home.pinpoint.com';
	const url = `${baseUrl}/${slug}/settings/deployments?id=${id}`;

	spinner.succeed(c.bold('Deployed ... 🚀 '));

	tick(terminalLink('View Deployment Status', url));
};

export const deploy = async ({ args }) => {
	if (args && args[0] === 'deploy') {
		const basedir = path.resolve(process.cwd());
		const config = path.join(basedir, 'pinpoint.config.js');
		if (!fs.existsSync(config)) {
			error(`Couldn't find ${config}. Please make sure you're running this command from a Pinpoint project`, true);
		}
		const tmpfile = tmp.fileSync({ postfix: '.zip' });
		const spinner = ora('Creating deployment package ...').start();
		try {
			const ignore = path.join(basedir, '.pinpointignore');
			let matcher = null;
			if (fs.existsSync(ignore)) {
				matcher = createMatcher(fs.readFileSync(ignore).toString());
			}
			const files = walkSync(basedir, createFilter(basedir, matcher));
			const zip = new AdmZip();
			files.forEach((fn) => {
				debug(`Adding ${fn} to zip...`);
				const dest = path.relative(basedir, fn);
				const destdir = path.dirname(dest);
				zip.addLocalFile(fn, destdir === basedir || destdir === '.' ? '' : destdir, path.basename(dest));
			});
			zip.writeZip(tmpfile.name);
			spinner.succeed(c.bold('Created deployment package'));
			await upload(tmpfile.name, config);
		} catch (ex) {
			spinner.fail(ex.message);
			process.exit(1);
		} finally {
			tmpfile.removeCallback();
		}
	}
};
