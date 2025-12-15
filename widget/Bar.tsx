import { createBinding, createComputed, createState, For } from "ags";
import { Astal, Gdk, Gtk } from "ags/gtk4";
import app from "ags/gtk4/app";
import { execAsync } from "ags/process";
import { createPoll } from "ags/time";
import Battery from "gi://AstalBattery";
import Hyprland from "gi://AstalHyprland";
import Tray from "gi://AstalTray";
import type AstalTray from "gi://AstalTray";
import Pango from "gi://Pango?version=1.0";
import Syncthing from "../utils/syncthing";
import SystemInfo from "../utils/systemInfo";
import Tailscale from "../utils/tailscale";
import { getHyprlandMonitor, getIcon } from "../utils/utils";

export default function Bar(gdkmonitor: Gdk.Monitor) {
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
				<box $type="start" hexpand halign={Gtk.Align.START} class="left">
					<Workspaces monitor={gdkmonitor} />
				</box>
				<box $type="center" class="center">
					<Title />
				</box>
				<box $type="end" hexpand halign={Gtk.Align.END} class="right">
					<CpuUsage />
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

type Desktop = {
	workspace: Hyprland.Workspace;
	clients: Hyprland.Client[];
	focused: boolean;
};

function Workspaces({ monitor }: { monitor: Gdk.Monitor }): JSX.Element {
	const hypr = Hyprland.get_default();
	const hyprMonitor = getHyprlandMonitor(monitor);
	const workspaces = createBinding(hypr, "workspaces");

	const [clients, setClients] = createState(hypr.get_clients());
	hypr.connect("client-added", (_, client) => {
		setClients((c) => [...c, client]);
	});
	hypr.connect("client-removed", (_, address) => {
		setClients((c) => c.filter((c) => c.address != address));
	});
	hypr.connect("client-moved", (hy) => {
		setClients(() => hy.get_clients());
	});

	const focusedWorkspace = createBinding(hypr, "focusedWorkspace");

	const desktops = createComputed(() => {
		const desktops: Desktop[] = [];

		if (!hyprMonitor) {
			return [];
		}

		// Get desktop for each workspace within monitor
		for (const workspace of workspaces()) {
			if (workspace.monitor == null) {
				continue;
			}

			if (hyprMonitor.id != workspace.monitor.id) {
				continue;
			}

			const desktop: Desktop = {
				workspace: workspace,
				clients: clients()
					.filter((client) => client.workspace && client.workspace.id === workspace.id)
					.sort((a, b) => a.x - b.x),
				focused: focusedWorkspace() ? workspace.id === focusedWorkspace().id : false,
			};
			desktops.push(desktop);
		}

		// Sort
		desktops.sort((a, b) => a.workspace.id - b.workspace.id);

		return desktops;
	});

	return (
		<box class="workspaces">
			<For each={desktops}>
				{(desktop) => (
					<button
						onClicked={() => desktop.workspace.focus()}
						tooltipText={`Workspace ${desktop.workspace.name}`}
						cursor={Gdk.Cursor.new_from_name("pointer", null)}
						class={desktop.focused ? "focused" : ""}
					>
						<Workspace clients={desktop.clients} />
					</button>
				)}
			</For>
		</box>
	);
}

function Workspace({ clients }: { clients: Hyprland.Client[] }) {
	return (
		<box>
			{clients.map((client) => (
				<image iconName={getIcon(client.initialClass, client.title)} tooltipText={client.title} />
			))}
		</box>
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
	const cpu = createBinding(system, "cpu_usage");

	const classNames = cpu.as((usage) => {
		if (usage < 80) {
			return "menu healthy";
		} else {
			return "menu unhealthy";
		}
	});

	const [toggle, setToggle] = createState(false);
	const label = createComputed(() => {
		if (toggle()) {
			return "CPU";
		} else {
			return `${Math.round(cpu())}%`;
		}
	});

	return (
		<overlay
			$={(self) => {
				const button = self.get_last_child();
				if (button) {
					self.set_measure_overlay(button, true);
				}
			}}
		>
			<levelbar orientation={Gtk.Orientation.HORIZONTAL} minValue={0} maxValue={100} value={cpu} />
			<button
				$type="overlay"
				halign={Gtk.Align.CENTER}
				cursor={Gdk.Cursor.new_from_name("pointer", null)}
				onClicked={() => setToggle(!toggle.peek())}
				class={classNames}
				tooltipText="CPU Usage"
			>
				<box>
					<image iconName="processor-symbolic" />
					<label label={label} />
				</box>
			</button>
		</overlay>
	);
}

function RamUsage(): JSX.Element {
	const system = SystemInfo.get_default();
	const mem = createBinding(system, "mem_usage");

	const classNames = mem.as((usage) => {
		if (usage < 90) {
			return "menu healthy";
		} else {
			return "menu unhealthy";
		}
	});

	const [toggle, setToggle] = createState(false);
	const label = createComputed(() => {
		if (toggle()) {
			return "RAM";
		} else {
			return `${Math.round(mem())}%`;
		}
	});

	return (
		<overlay
			$={(self) => {
				const button = self.get_last_child();
				if (button) {
					self.set_measure_overlay(button, true);
				}
			}}
		>
			<levelbar orientation={Gtk.Orientation.HORIZONTAL} minValue={0} maxValue={100} value={mem} />
			<button
				$type="overlay"
				halign={Gtk.Align.CENTER}
				cursor={Gdk.Cursor.new_from_name("pointer", null)}
				onClicked={() => setToggle(!toggle.peek())}
				class={classNames}
				tooltipText="RAM Usage"
			>
				<box>
					<image iconName="memory-symbolic" />
					<label label={label} />
				</box>
			</button>
		</overlay>
	);
}

function BatteryUsage() {
	const bat = Battery.get_default();
	if (!bat.isPresent) return <box visible={false} />;

	const charge = createBinding(bat, "percentage");

	const classNames = charge.as((charge) => {
		if (charge > 0.2) {
			return "menu healthy";
		} else {
			return "menu unhealthy";
		}
	});

	const [toggle, setToggle] = createState(false);
	const label = createComputed(() => {
		if (toggle()) {
			return "Battery";
		} else {
			return `${Math.round(charge() * 100)}%`;
		}
	});

	return (
		<overlay
			$={(self) => {
				const button = self.get_last_child();
				if (button) {
					self.set_measure_overlay(button, true);
				}
			}}
		>
			<levelbar orientation={Gtk.Orientation.HORIZONTAL} minValue={0} maxValue={1} value={charge} />
			<button
				$type="overlay"
				halign={Gtk.Align.CENTER}
				cursor={Gdk.Cursor.new_from_name("pointer", null)}
				onClicked={() => setToggle(!toggle.peek())}
				class={classNames}
				tooltipText="Battery Usage"
			>
				<box>
					<image iconName={bat.iconName} />
					<label label={label} />
				</box>
			</button>
		</overlay>
	);
}

function TailscaleWidget(): JSX.Element {
	const tailscale = Tailscale.get_default();
	const connected = createBinding(tailscale, "connected");

	const classNames = connected.as((connected) => {
		if (connected) {
			return "menu healthy";
		} else {
			return "menu unhealthy";
		}
	});

	return (
		<box>
			<button
				onClicked={() => execAsync("xdg-open https://login.tailscale.com/admin/machines")}
				cursor={Gdk.Cursor.new_from_name("pointer", null)}
				class={classNames}
				tooltipText="Tailscale Status"
			>
				<image iconName={getIcon("tailscale")} />
			</button>
		</box>
	);
}

function SyncthingWidget(): JSX.Element {
	const syncthing = Syncthing.get_default();
	const connected = createBinding(syncthing, "connected");

	const classNames = connected.as((connected) => {
		if (connected) {
			return "menu healthy";
		} else {
			return "menu unhealthy";
		}
	});

	return (
		<box>
			<button
				onClicked={() => execAsync("xdg-open http://localhost:8384/")}
				cursor={Gdk.Cursor.new_from_name("pointer", null)}
				class={classNames}
				tooltipText="Syncthing Status"
			>
				<image iconName={getIcon("syncthing")} />
			</button>
		</box>
	);
}

function SysTray(): JSX.Element {
	const tray = Tray.get_default();
	const items = createBinding(tray, "items");

	const init = (btn: Gtk.MenuButton, item: AstalTray.TrayItem) => {
		btn.menuModel = item.menuModel;
		btn.insert_action_group("dbusmenu", item.actionGroup);
		item.connect("notify::action-group", () => {
			btn.insert_action_group("dbusmenu", item.actionGroup);
		});
	};

	return (
		<box class="tray">
			<For each={items}>
				{(item) => (
					<menubutton
						class="menu"
						$={(self) => init(self, item)}
						cursor={Gdk.Cursor.new_from_name("pointer", null)}
					>
						<image gicon={createBinding(item, "gicon")} />
					</menubutton>
				)}
			</For>
		</box>
	);
}

function Time(): JSX.Element {
	const time = createPoll("", 1000, 'date "+%I:%M %D"');

	return (
		<menubutton class="menu" cursor={Gdk.Cursor.new_from_name("pointer", null)}>
			<label label={time} />
			<popover>
				<Gtk.Calendar />
			</popover>
		</menubutton>
	);
}
