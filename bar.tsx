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
import { animate } from "./utils/animate";
import NvTop from "./utils/nvtop";
import Sensors from "./utils/sensors";
import Syncthing from "./utils/syncthing";
import System from "./utils/system";
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

	const title = focused((client) => {
		if (client) {
			return client.title;
		} else {
			return "";
		}
	});

	const icon = focused((client) => {
		if (!client) {
			return "item-missing-symbolic";
		}

		return getIcon(client.initialClass, client.title);
	});

	const available = focused((client) => (client ? true : false));

	return (
		<box class="title" visible={available}>
			<image iconName={icon} />
			<label valign={Gtk.Align.CENTER} label={title} ellipsize={Pango.EllipsizeMode.END} />
		</box>
	);
}

function CpuUsage(): JSX.Element {
	const system = System.get_default();
	const sensors = Sensors.get_default();

	const usage = createBinding(system, "cpu_total");
	const usage_str = usage((usage) => `${usage.toString()}%`);

	const system_str = createBinding(system, "cpu_system")((usage) => `${usage.toString()}%`);
	const user_str = createBinding(system, "cpu_user")((usage) => `${usage.toString()}%`);

	const temp = createBinding(sensors, "cpu_temp");
	const temp_max = createBinding(sensors, "cpu_max");
	const temp_available = temp((temp) => temp > 0);
	const temp_str = temp((temp) => `${temp.toString()}°C`);

	const color = createComputed(() =>
		animate("cpu", () => {
			const u = usage();
			const t = temp();
			const m = temp_max();

			if (u > 80 || t > m) {
				return "red";
			} else if (u > 60 || t > m * 0.8) {
				return "yellow";
			} else {
				return "green";
			}
		}),
	);

	return (
		<menubutton
			class={color}
			halign={Gtk.Align.CENTER}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			tooltipText={usage_str}
		>
			<image iconName="indicator-sensors-cpu" />
			<popover>
				<box spacing={4} orientation={Gtk.Orientation.VERTICAL}>
					<box spacing={16}>
						<label label="Usage" hexpand halign={Gtk.Align.START} />
						<label label={usage_str} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16} visible={temp_available}>
						<label label="Temp" hexpand halign={Gtk.Align.START} />
						<label label={temp_str} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="System" hexpand halign={Gtk.Align.START} />
						<label label={system_str} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="User" hexpand halign={Gtk.Align.START} />
						<label label={user_str} hexpand halign={Gtk.Align.END} />
					</box>
				</box>
			</popover>
		</menubutton>
	);
}

function GpuUsage(): JSX.Element {
	const nvtop = NvTop.get_default();

	const usage = createBinding(nvtop, "usage");
	const usage_str = usage((usage) => `${usage.toString()}%`);

	const temp = createBinding(nvtop, "temp");
	const temp_available = temp((temp) => temp > 0);
	const temp_str = temp((temp) => `${temp.toString()}°C`);

	const encode_str = createBinding(nvtop, "encode")((usage) => `${usage.toString()}%`);

	const color = usage((usage) =>
		animate("gpu", () => {
			if (usage > 80) {
				return "red";
			} else if (usage > 60) {
				return "yellow";
			} else {
				return "green";
			}
		}),
	);

	return (
		<menubutton
			halign={Gtk.Align.CENTER}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			class={color}
			tooltipText={usage_str}
		>
			<image iconName="indicator-sensors-gpu" />
			<popover>
				<box spacing={4} orientation={Gtk.Orientation.VERTICAL}>
					<box spacing={16}>
						<label label="Usage" hexpand halign={Gtk.Align.START} />
						<label label={usage_str} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="Encode" hexpand halign={Gtk.Align.START} />
						<label label={encode_str} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16} visible={temp_available}>
						<label label="Temp" hexpand halign={Gtk.Align.START} />
						<label label={temp_str} hexpand halign={Gtk.Align.END} />
					</box>
				</box>
			</popover>
		</menubutton>
	);
}

function RamUsage(): JSX.Element {
	const system = System.get_default();
	const usage = createBinding(system, "mem_usage");

	const usage_str = usage((usage) => `${usage.toString()}%`);
	const cached_str = createBinding(
		system,
		"mem_cached",
	)((cached) => `${(cached / 1024 / 1024 / 1024).toFixed(2)} GB`);
	const used_str = createBinding(
		system,
		"mem_used",
	)((used) => `${(used / 1024 / 1024 / 1024).toFixed(2)} GB`);
	const free_str = createBinding(
		system,
		"mem_free",
	)((free) => `${(free / 1024 / 1024 / 1024).toFixed(2)} GB`);

	const color = usage((usage) =>
		animate("memory", () => {
			if (usage > 80) {
				return "red";
			} else if (usage > 60) {
				return "yellow";
			} else {
				return "green";
			}
		}),
	);

	return (
		<menubutton
			halign={Gtk.Align.CENTER}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			class={color}
			tooltipText={usage_str}
		>
			<image iconName="memory-stick" />
			<popover>
				<box spacing={4} orientation={Gtk.Orientation.VERTICAL}>
					<box spacing={16}>
						<label label="Usage" hexpand halign={Gtk.Align.START} />
						<label label={usage_str} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="Cached" hexpand halign={Gtk.Align.START} />
						<label label={cached_str} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="Used" hexpand halign={Gtk.Align.START} />
						<label label={used_str} hexpand halign={Gtk.Align.END} />
					</box>
					<box spacing={16}>
						<label label="Free" hexpand halign={Gtk.Align.START} />
						<label label={free_str} hexpand halign={Gtk.Align.END} />
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

	const color = charge((charge) =>
		animate("battery", () => {
			if (charge < 0.2) {
				return "red";
			} else if (charge < 0.4) {
				return "yellow";
			} else {
				return "green";
			}
		}),
	);
	const usage_str = charge((charge) => `${Math.round(charge * 100)}%`);

	return (
		<button
			halign={Gtk.Align.CENTER}
			cursor={Gdk.Cursor.new_from_name("pointer", null)}
			class={color}
			tooltipText={usage_str}
		>
			<image iconName={bat.battery_icon_name} />
		</button>
	);
}

function TailscaleWidget(): JSX.Element {
	const tailscale = Tailscale.get_default();
	const connected = createBinding(tailscale, "connected");

	const color = connected((connected) =>
		animate("tailscale", () => (connected ? "green" : "gray")),
	);

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

	const color = connected((connected) =>
		animate("syncthing", () => (connected ? "green" : "gray")),
	);

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
	const connected = connectivity((connectivity) =>
		animate("network", () => {
			switch (connectivity) {
				case Network.Connectivity.FULL:
					return "green";
				case Network.Connectivity.LIMITED:
					return "yellow";
				case Network.Connectivity.NONE:
					return "red";
				default:
					return "gray";
			}
		}),
	);

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
