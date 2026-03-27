import { createBinding, For, This } from "ags";
import app from "ags/gtk4/app";
import Bar from "./bar";
import style from "./style.scss";

app.start({
	css: style,
	gtkTheme: "Adwaita", // build off default theme
	icons: `${SRC}/icons`,
	instanceName: "trevbar",
	main() {
		const monitors = createBinding(app, "monitors");

		return (
			<For each={monitors}>
				{(monitor) => (
					<This this={app}>
						<Bar gdkmonitor={monitor} />
					</This>
				)}
			</For>
		);
	},
});
