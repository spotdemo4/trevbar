import { createBinding, createComputed, For } from "ags";
import { Astal, Gdk, Gtk } from "ags/gtk4";
import app from "ags/gtk4/app";
import { execAsync } from "ags/process";
import { createPoll } from "ags/time";
import Battery from "gi://AstalBattery";
import Hyprland from "gi://AstalHyprland";
import Network from "gi://AstalNetwork";
import Tray from "gi://AstalTray";
import type AstalTray from "gi://AstalTray";
import Pango from "gi://Pango?version=1.0";
import NvTop from "./utils/nvtop";
import Syncthing from "./utils/syncthing";
import SystemInfo from "./utils/systemInfo";
import Tailscale from "./utils/tailscale";
import { getHyprlandMonitor, getIcon } from "./utils/utils";

export default function Bar({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
	const { TOP, LEFT, RIGHT } = Astal.WindowAnchor;

	return (
		<window
			visible
			name="trevbar"
			class="Bar"
			gdkmonitor={gdkmonitor}
			exclusivity={Astal.Exclusivity.EXCLUSIVE}
			anchor={TOP | LEFT | RIGHT}
			application={app}
		>
			<centerbox cssName="centerbox">
				<box $type="start" hexpand halign={Gtk.Align.START}>
					<Workspaces monitor={gdkmonitor} />
				</box>
				<box $type="center">
					<Title />
				</box>
				<box $type="end" hexpand halign={Gtk.Align.END} class="tray">
					<CpuUsage />
					<GpuUsage />
					<RamUsage />
					<BatteryUsage />
					<TailscaleWidget />
					<SyncthingWidget />
					<SysTray />
					<Time />
				</box>
			</centerbox>
		</window>
	);
}

function Workspaces({ monitor }: { monitor: Gdk.Monitor }): JSX.Element {
	const hypr = Hyprland.get_default();
	const hyprMonitor = getHyprlandMonitor(monitor);
	if (!hyprMonitor) {
		return <box />;
	}
	const workspaces = createBinding(
		hypr,
		"workspaces",
	)((w) =>
		w.filter((workspace) => workspace.monitor.id === hyprMonitor.id).sort((a, b) => a.id - b.id),
	);

	return (
		<box class="workspaces">
			<For each={workspaces}>{(workspace) => <Workspace workspace={workspace} />}</For>
		</box>
	);
}

function Workspace({ workspace }: { workspace: Hyprland.Workspace }) {
	const hypr = Hyprland.get_default();
	const focused = createBinding(hypr, "focusedWorkspace")((w) => w.id === workspace.id);
	const clients = createBinding(
		hypr,
		"clients",
	)((c) => c.filter((client) => client.workspace.id === workspace.id).sort((a, b) => a.x - b.x));

	return (
		<togglebutton
			onClicked={() => workspace.focus()}
			tooltipText={`Workspace ${workspace.name}`}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			active={focused}
		>
			<box>
				<For each={clients}>
					{(client) => (
						<image
							iconName={getIcon(client.initialClass, client.title)}
							tooltipText={client.title}
						/>
					)}
				</For>
			</box>
		</togglebutton>
	);
}

function Title(): JSX.Element {
	const hypr = Hyprland.get_default();
	const focused = createBinding(hypr, "focusedClient");

	const focusedClient = createComputed(() => {
		if (focused()) {
			return focused();
		}

		const client = hypr.get_focused_client();
		if (client) {
			return client;
		}

		return null;
	});

	const clientIcon = focusedClient.as((c) => {
		if (!c) {
			return "item-missing-symbolic";
		}

		const icon = getIcon(c.initialClass, c.title);
		return icon;
	});

	const clientTitle = focusedClient.as((c) => {
		if (!c || !c.title) {
			return "n/a";
		}

		return c.title;
	});

	const clientAvailable = focusedClient.as((c) => {
		if (!c || !c.title) {
			return false;
		}

		return true;
	});

	return (
		<box class="title" visible={clientAvailable}>
			<image iconName={clientIcon} />
			<label valign={Gtk.Align.CENTER} label={clientTitle} ellipsize={Pango.EllipsizeMode.END} />
		</box>
	);
}

function CpuUsage(): JSX.Element {
	const system = SystemInfo.get_default();
	const cpu = createBinding(system, "cpu_total");
	const cpu_usage = cpu((usage) => `${usage.toString()}%`);
	const cpu_system = createBinding(system, "cpu_system")((usage) => `${usage.toString()}%`);
	const cpu_user = createBinding(system, "cpu_user")((usage) => `${usage.toString()}%`);

	let prev = "green";
	const color = cpu((usage) => {
		let next: string;
		if (usage > 80) {
			next = "red";
		} else if (usage > 60) {
			next = "yellow";
		} else {
			next = "green";
		}

		if (prev === next) {
			return prev;
		}

		const animation = `${prev}-${next}`;
		prev = next;

		return animation;
	});
	const usage = cpu((usage) => `${Math.round(usage).toString()}%`);

	return (
		<menubutton
			class={color}
			halign={Gtk.Align.CENTER}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			tooltipText={usage}
		>
			<image iconName="indicator-sensors-cpu" />
			<popover>
				<box spacing={4} orientation={Gtk.Orientation.VERTICAL}>
					<box spacing={16}>
						<label label="Usage" hexpand halign={Gtk.Align.START} />
						<label label={cpu_usage} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="System" hexpand halign={Gtk.Align.START} />
						<label label={cpu_system} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="User" hexpand halign={Gtk.Align.START} />
						<label label={cpu_user} hexpand halign={Gtk.Align.END} />
					</box>
				</box>
			</popover>
		</menubutton>
	);
}

function GpuUsage(): JSX.Element {
	const nvtop = NvTop.get_default();
	const gpu = createBinding(nvtop, "gpu_usage");
	const gpu_usage = gpu((usage) => `${usage.toString()}%`);
	const encode_usage = createBinding(nvtop, "encode")((usage) => `${usage.toString()}%`);
	const temp = createBinding(nvtop, "temp")((temp) => `${temp.toString()}°C`);

	let prev = "green";
	const color = gpu((usage) => {
		let next: string;
		if (usage > 80) {
			next = "red";
		} else if (usage > 60) {
			next = "yellow";
		} else {
			next = "green";
		}

		if (prev === next) {
			return prev;
		}

		const animation = `${prev}-${next}`;
		prev = next;

		return animation;
	});
	const usage = gpu((usage) => `${Math.round(usage).toString()}%`);

	return (
		<menubutton
			halign={Gtk.Align.CENTER}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			class={color}
			tooltipText={usage}
		>
			<image iconName="indicator-sensors-gpu" />
			<popover>
				<box spacing={4} orientation={Gtk.Orientation.VERTICAL}>
					<box spacing={16}>
						<label label="Usage" hexpand halign={Gtk.Align.START} />
						<label label={gpu_usage} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="Encode" hexpand halign={Gtk.Align.START} />
						<label label={encode_usage} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="Temp" hexpand halign={Gtk.Align.START} />
						<label label={temp} hexpand halign={Gtk.Align.END} />
					</box>
				</box>
			</popover>
		</menubutton>
	);
}

function RamUsage(): JSX.Element {
	const system = SystemInfo.get_default();
	const mem = createBinding(system, "mem_usage");
	const mem_usage = mem((usage) => `${usage.toString()}%`);
	const cached = createBinding(
		system,
		"mem_cached",
	)((cached) => `${(cached / 1024 / 1024 / 1024).toFixed(2)} GB`);
	const used = createBinding(
		system,
		"mem_used",
	)((used) => `${(used / 1024 / 1024 / 1024).toFixed(2)} GB`);
	const free = createBinding(
		system,
		"mem_free",
	)((free) => `${(free / 1024 / 1024 / 1024).toFixed(2)} GB`);

	let prev = "green";
	const color = mem((usage) => {
		let next: string;
		if (usage > 80) {
			next = "red";
		} else if (usage > 60) {
			next = "yellow";
		} else {
			next = "green";
		}

		if (prev === next) {
			return prev;
		}

		const animation = `${prev}-${next}`;
		prev = next;

		return animation;
	});
	const usage = mem((usage) => `${Math.round(usage).toString()}%`);

	return (
		<menubutton
			halign={Gtk.Align.CENTER}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			class={color}
			tooltipText={usage}
		>
			<image iconName="memory-stick" />
			<popover>
				<box spacing={4} orientation={Gtk.Orientation.VERTICAL}>
					<box spacing={16}>
						<label label="Usage" hexpand halign={Gtk.Align.START} />
						<label label={mem_usage} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="Cached" hexpand halign={Gtk.Align.START} />
						<label label={cached} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="Used" hexpand halign={Gtk.Align.START} />
						<label label={used} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="Free" hexpand halign={Gtk.Align.START} />
						<label label={free} hexpand halign={Gtk.Align.END} />
					</box>
				</box>
			</popover>
		</menubutton>
	);
}

function BatteryUsage() {
	const bat = Battery.get_default();
	if (!bat.isPresent) return <box visible={false} />;

	const charge = createBinding(bat, "percentage");

	let prev = "green";
	const color = charge((charge) => {
		let next: string;
		if (charge < 0.2) {
			next = "red";
		} else if (charge < 0.4) {
			next = "yellow";
		} else {
			next = "green";
		}

		if (prev === next) {
			return prev;
		}

		const animation = `${prev}-${next}`;
		prev = next;

		return animation;
	});
	const usage = charge((charge) => `${Math.round(charge * 100)}%`);

	return (
		<button
			halign={Gtk.Align.CENTER}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			class={color}
			tooltipText={usage}
		>
			<image iconName={bat.battery_icon_name} />
		</button>
	);
}

function TailscaleWidget(): JSX.Element {
	const tailscale = Tailscale.get_default();
	const connected = createBinding(tailscale, "connected");
	const color = connected((connected) => (connected ? "green" : ""));

	return (
		<button
			onClicked={() => execAsync("xdg-open https://login.tailscale.com/admin/machines")}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			class={color}
			tooltipText="Tailscale"
		>
			<image iconName={getIcon("tailscale")} />
		</button>
	);
}

function SyncthingWidget(): JSX.Element {
	const syncthing = Syncthing.get_default();
	const connected = createBinding(syncthing, "connected");
	const color = connected((connected) => (connected ? "green" : ""));

	return (
		<button
			onClicked={() => execAsync("xdg-open http://localhost:8384/")}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			class={color}
			tooltipText="Syncthing"
		>
			<image iconName={getIcon("syncthing")} />
		</button>
	);
}

function SysTray(): JSX.Element {
	const tray = Tray.get_default();
	const items = createBinding(tray, "items");

	const init = (btn: Gtk.MenuButton, item: AstalTray.TrayItem) => {
		try {
			btn.menuModel = item.menuModel;
			btn.insert_action_group("dbusmenu", item.actionGroup);
			item.connect("notify::action-group", () => {
				btn.insert_action_group("dbusmenu", item.actionGroup);
			});
		} catch (e) {
			console.error("Failed to initialize tray item", e);
		}
	};

	const network = Network.get_default();
	const connectivity = createBinding(network, "connectivity");
	const connected = connectivity((connectivity) => {
		switch (connectivity) {
			case Network.Connectivity.FULL:
				return "green";
			case Network.Connectivity.LIMITED:
				return "yellow";
			case Network.Connectivity.NONE:
				return "red";
			default:
				return "";
		}
	});

	return (
		<box class="tray">
			<For each={items}>
				{(item) => {
					if (item.get_title() == "Network") {
						return (
							<menubutton
								$={(self) => init(self, item)}
								class={connected}
								cursor={Gdk.Cursor.new_from_name("pointer", null)}
							>
								<image gicon={createBinding(item, "gicon")} />
							</menubutton>
						);
					}

					return (
						<menubutton
							$={(self) => init(self, item)}
							cursor={Gdk.Cursor.new_from_name("pointer", null)}
						>
							<image gicon={createBinding(item, "gicon")} />
						</menubutton>
					);
				}}
			</For>
		</box>
	);
}

function Time(): JSX.Element {
	const time = createPoll("", 1000, 'date "+%I:%M %D"');

	return (
		<menubutton class="menu" cursor={Gdk.Cursor.new_from_name("pointer", null)}>
			<label label={time} class="time" />
			<popover>
				<Gtk.Calendar />
			</popover>
		</menubutton>
	);
}
