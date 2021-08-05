import { runningFromYarn, runningFromNpx, showBanner, getPackageJSON } from './util.mjs';

export const showHelpMessage = (args, options, argsSpec, commandSpec) => {
	if (options.help || (commandSpec && args.length === 0)) {
		showBanner();
		const pkg = getPackageJSON();
		const pinpoint = pkg['@pinpt/cli'] || {};
		const cmdarg = commandSpec ? '<command>' : '';
		if (runningFromYarn()) {
			const yarn = pinpoint.yarn;
			console.log(` Usage: ${yarn} [options] ${cmdarg}`);
		} else if (runningFromNpx()) {
			const npx = pinpoint.npx;
			console.log(` Usage: ${npx} [options] ${cmdarg}`);
		} else {
			const name = pinpoint.default;
			console.log(` Usage: ${name} [options] ${cmdarg}`);
		}
		if (commandSpec) {
			console.log();
			console.log(' Commands:');
			console.log();
			console.log(
				Object.keys(commandSpec)
					.map((cmd) => {
						const spec = commandSpec[cmd];
						return `   ${cmd.padEnd(25)} ${spec.description}`;
					})
					.join('\n')
			);
			console.log();
		}
		console.log();
		console.log(' Options:');
		console.log();
		console.log(
			Object.keys(argsSpec)
				.filter((key) => !argsSpec[key].hidden)
				.map((key) => {
					const flag = argsSpec[key];
					const flagDefault = flag.default;
					const def = `${flagDefault ? `[default=${flagDefault}]` : ''}`;
					const prefix = flag.alias ? `-${flag.alias}, ` : '';
					const _flag = prefix + `--${key}`;
					return `   ${_flag.padEnd(25)} ${flag.description} ${def}`;
				})
				.join('\n')
		);
		console.log();
		process.exit(0);
	}
};
