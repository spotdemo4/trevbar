import { createState } from "ags";

type Transition = {
  from: string;
  to: string;
  className: ReturnType<typeof createState<string>>[0];
  setClassName: ReturnType<typeof createState<string>>[1];
  timeout?: ReturnType<typeof setTimeout>;
};

const duration = 1000; // ms

const transitions = new Map<string, Transition>();

export function animate(name: string, colorFunc: () => string) {
  const next_color = colorFunc();

  if (!transitions.has(name)) {
    const [className, setClassName] = createState(transitionClass("gray", next_color));
    const next_transition: Transition = {
      from: "gray",
      to: next_color,
      className,
      setClassName,
    };
    transitions.set(name, next_transition);
    clearAnimation(next_transition);

    return className();
  }

  const last_transition = transitions.get(name)!;
  const current_class = last_transition.className();

  if (last_transition.to === next_color) {
    return current_class;
  }

  last_transition.from = last_transition.to;
  last_transition.to = next_color;
  const next_class = transitionClass(last_transition.from, last_transition.to);
  last_transition.setClassName(next_class);
  clearAnimation(last_transition);

  console.debug(`Animating ${name} from ${last_transition.from} to ${last_transition.to}`);

  return next_class;
}

function clearAnimation(t: Transition) {
  if (t.timeout) {
    clearTimeout(t.timeout);
  }

  if (t.from === t.to) {
    t.setClassName(t.to);
    return;
  }

  const color = t.to;
  t.timeout = setTimeout(() => {
    if (t.to === color) {
      t.setClassName(color);
      t.timeout = undefined;
    }
  }, duration);
}

function transitionClass(from: string, to: string) {
  if (from === to) return to;

  return `${to} ${from}-to-${to}`;
}
