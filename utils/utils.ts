import { Astal, Gdk } from "astal/gtk3"
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

export function getIcon(n: string) {
    const name = n.toLowerCase();

    if (name == "zen-alpha") {
        return getIcon("firefox");
    }

    const icon = Astal.Icon.lookup_icon(name)?.get_filename()
    if (icon) {
        return icon;
    }

    return "item-missing-symbolic";
}