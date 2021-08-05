import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import AdmZip from 'adm-zip';
import tmp from 'tmp';
import picomatch from 'picomatch';
import ora from 'ora';
import c from 'kleur';
import progress from 'cli-progress';
import { debug, error, walkSync, apiRequest, readPinpointConfig } from './util.mjs';

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
	return builtIns(fn) === false;
};

const upload = async (fn, config) => {
	const { siteId } = readPinpointConfig(config);
	if (!siteId) {
		throw new Error(`No required siteId variable found in ${config}`);
	}

	const p = new progress.SingleBar({
		format: '' + c.green('{bar}') + ' {percentage}% || {value}/{total} Chunks',
		barCompleteChar: '\u2588',
		barIncompleteChar: '\u2591',
		hideCursor: true,
		clearOnComplete: true,
	});

	p.start(100, 0);

	const spinner = ora('Validating ...');

	const body = new FormData();
	body.append('upload', fs.createReadStream(fn));

	await apiRequest('', `/site/${siteId}/theme/upload2`, {
		noSpinner: true,
		method: 'POST',
		body,
		onProgress: (progress) => {
			p.update(100 * progress.percent);
			if (progress.percent === 1) {
				p.stop();
				spinner.start();
			}
		},
	});

	spinner.succeed(c.bold('Deployed ... 🚀'));
};

export const deploy = async ({ args }) => {
	if (args && args[0] === 'deploy') {
		const config = path.join(process.cwd(), 'pinpoint.config.js');
		if (!fs.existsSync(config)) {
			error(`Couldn't find ${config}. Please make sure you're running this command from a Pinpoint project`, true);
		}
		const tmpfile = tmp.fileSync();
		const spinner = ora('Creating deployment package ...').start();
		try {
			const ignore = path.join(process.cwd(), '.pinpointignore');
			let matcher = null;
			if (fs.existsSync(ignore)) {
				matcher = createMatcher(fs.readFileSync(ignore).toString());
			}
			const files = walkSync(process.cwd(), createFilter(process.cwd(), matcher));
			const zip = new AdmZip();
			files.forEach((fn) => {
				debug(`Adding ${fn} to zip...`);
				zip.addLocalFile(fn);
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
