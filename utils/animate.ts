const previousColors = new Map<string, string>();

export function animate(name: string, colorFunc: () => string) {
	const color = colorFunc();

	if (!previousColors.has(name)) {
		previousColors.set(name, color);
		return color;
	}

	const previousColor = previousColors.get(name);

	if (previousColor === color) {
		return color;
	}

	previousColors.set(name, color);
	console.log(`Animating ${name} from ${previousColor} to ${color}`);

	return `${previousColor}-to-${color}`;
}
