type Transition = {
	from: string;
	to: string;
};

const transitions = new Map<string, Transition>();

export function animate(name: string, colorFunc: () => string) {
	const next_color = colorFunc();

	if (!transitions.has(name)) {
		const next_transition: Transition = {
			from: "gray",
			to: next_color,
		};
		transitions.set(name, next_transition);

		return transitionString(next_transition);
	}

	const last_transition = transitions.get(name)!;
	if (last_transition.to === next_color) {
		return transitionString(last_transition);
	}

	const next_transition: Transition = {
		from: last_transition.to,
		to: next_color,
	};
	transitions.set(name, next_transition);

	console.log(`Animating ${name} from ${next_transition.from} to ${next_transition.to}`);

	return transitionString(next_transition);
}

function transitionString(t: Transition) {
	return `${t.from}-to-${t.to}`;
}
