import { Gdk, Gtk } from "ags/gtk4";
import Hyprland from "gi://AstalHyprland";

const display = Gdk.Display.get_default();
const iconTheme = display ? Gtk.IconTheme.get_for_display(display) : Gtk.IconTheme.new();

export function getHyprlandMonitor(monitor: Gdk.Monitor): Hyprland.Monitor | null {
	const hypr = Hyprland.get_default();

	// Try to get hyprland monitor with name
	const connector = monitor.get_connector();
	if (connector) {
		const hyprMonitor = hypr.get_monitor_by_name(connector);
		if (hyprMonitor) {
			return hyprMonitor;
		}
	}

	// Try to get hyprland monitor with cooordinates
	const hyprlandMonitors = hypr.get_monitors();
	for (const m of hyprlandMonitors) {
		const geometry = monitor.get_geometry();
		if (
			m.x === geometry.x &&
			m.y === geometry.y &&
			m.height === geometry.height &&
			m.width === geometry.width
		) {
			return m;
		}
	}

	// Try to get hyprland monitor with manufacturer and model
	if (monitor.get_manufacturer() || monitor.get_model()) {
		for (const m of hyprlandMonitors) {
			if (m.get_make() === monitor.get_manufacturer() && m.get_model() === monitor.get_model()) {
				return m;
			}
		}
	}

	return null;
}

export function sortByMaster(clients: Hyprland.Client[]) {
	if (clients.length === 0) {
		return [];
	}

	// Find master by the most left nonfloating client
	return clients.sort((a, b) => {
		if (a.floating === b.floating) {
			return a.x - b.x;
		}

		return !a.floating && b.floating ? 1 : -1;
	});
}

export function getIcon(name?: string, fallback?: string): string {
	name = name?.toLowerCase();
	fallback = fallback?.toLowerCase();

	// Hard-coded icons
	switch (name) {
		case "zen-beta":
		case "zen-alpha":
		case "zen":
			return getIcon("zen-white", fallback);
		case "jetbrains-datagrip":
			return getIcon("datagrip", fallback);
		case "jetbrains-idea-ce":
			return getIcon("idea", fallback);
		case "onlyoffice desktop editors":
			return getIcon("onlyoffice-desktopeditors", fallback);
		case "vesktop":
			return getIcon("discord-tray", fallback);
		case "syncthing":
			return getIcon("si-syncthing-2", fallback);
		case "codium":
			return getIcon("vscodium", fallback);
	}

	if (!name || !iconTheme.has_icon(name)) {
		console.log(`Icon not found: ${name}`);

		if (fallback) {
			return getIcon(fallback);
		}

		return "item-missing-symbolic";
	}

	return name;
}
