type Transition = {
	from: string;
	to: string;
};

const transitions = new Map<string, Transition>();

export function animate(name: string, colorFunc: () => string) {
	const next_color = colorFunc();

	if (!transitions.has(name)) {
		transitions.set(name, { from: "gray", to: next_color });
		return next_color;
	}

	const last_transition = transitions.get(name)!;

	if (last_transition.to === next_color) {
		return transitionString(last_transition);
	}

	transitions.set(name, { from: last_transition.to, to: next_color });
	console.log(`Animating ${name} from ${last_transition.to} to ${next_color}`);

	return transitionString(transitions.get(name)!);
}

function transitionString(t: Transition) {
	return `${t.from}-to-${t.to}`;
}
