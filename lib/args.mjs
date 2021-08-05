import arg from 'arg';

export const getArgs = (optionSpec) => {
	let OPTIONS = false;
	let ARGS = [];

	const _args = {};
	Object.keys(optionSpec).forEach((key) => {
		const spec = optionSpec[key];
		_args[`--${key}`] = spec.type;
		if (spec.alias) {
			_args[`-${spec.alias}`] = `--${key}`;
		}
	});

	const res = arg(_args, { permissive: true });

	ARGS = res._;
	OPTIONS = {};

	Object.keys(optionSpec).forEach((key) => {
		const spec = optionSpec[key];
		OPTIONS[key] = res[`--${key}`] || res[`-${spec.alias}`] || spec.default;
	});

	// console.log({ OPTIONS, ARGS, _args, res });

	return [OPTIONS, ARGS];
};
