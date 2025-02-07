import { Astal, Gdk, Gtk } from "astal/gtk3"
import { timeout } from "astal/time"
import Hyprland from "gi://AstalHyprland"

export function getHyprlandMonitor(monitor: Gdk.Monitor): Hyprland.Monitor | null {
    const hypr = Hyprland.get_default()

    // Try to get hyprland monitor with name
    const screen = monitor.get_display().get_default_screen()
    const monitorCount = monitor.get_display().get_n_monitors()
    for (let i = 0; i < monitorCount; i++) {
        if (monitor === monitor.get_display().get_monitor(i)) {
            const monitorName = screen.get_monitor_plug_name(i)

            if (monitorName && hypr.get_monitor_by_name(monitorName)) {
                return hypr.get_monitor_by_name(monitorName)
            }
        }
    }

    // Try to get hyprland monitor with cooordinates
    const hyprlandMonitors = hypr.get_monitors()
    for (let m of hyprlandMonitors) {
        const geometry = monitor.get_geometry()
        if (m.x === geometry.x && m.y === geometry.y && m.height === geometry.height && m.width === geometry.width) {
            return m
        }
    }

    // Try to get hyprland monitor with manufacturer and model
    if (monitor.get_manufacturer() || monitor.get_model()) {
        for (let m of hyprlandMonitors) {
            if (m.get_make() === monitor.get_manufacturer() && m.get_model() === monitor.get_model()) {
                return m
            }
        }
    }

    return null;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        timeout(ms, resolve);
    });
}

export function sortByMaster(clients: Hyprland.Client[]) {
    if (clients.length === 0) {
        return [];
    }

    // Find master by the most left nonfloating client
    return clients.sort((a, b) => {
        if (a.floating === b.floating) {
            return a.x - b.x
        }

        return !a.floating && b.floating ? 1 : -1;
    });
}

export function getIcon(name: string, symbolic = false): Gtk.IconInfo | null {
    if (name == null || name == "") {
        return null;
    }

    const lcname = name.toLowerCase();

    // Hardcoded icons
    switch (lcname) {
        case 'zen-beta':
        case 'zen-alpha':
        case 'zen':
            return getIcon("zen-white-symbolic");
        case 'jetbrains-datagrip':
            return getIcon("datagrip");
        case 'jetbrains-idea-ce':
            return getIcon("idea");
        case 'onlyoffice desktop editors':
            return getIcon("onlyoffice-desktopeditors");
        case 'vesktop':
            if (symbolic) {
                return getIcon("discord-tray");
            }

            return getIcon("discord");
        case 'syncthing':
            return getIcon("si-syncthing-2")
    }

    // Try to find icon in iconpack
    const icon = Astal.Icon.lookup_icon(lcname)
    if (icon) {
        return icon
    }

    return null;
}