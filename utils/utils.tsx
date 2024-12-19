import { Astal, Gdk, Widget } from "astal/gtk3"
import { timeout } from "astal/time"
import { readFile } from "astal/file"
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

export function doesBiconExist(name: string): boolean {
    const bicon = Bicon({ name: name });

    if (bicon.icon == "item-missing-symbolic") {
        return false;
    }

    return true;
}

export function Bicon({ name, tooltip, symbolic = false }: { name: string, tooltip?: string, symbolic?: boolean }): Widget.Icon {
    if (name == null || name == "") {
        return new Widget.Icon({
            icon: 'item-missing-symbolic'
        })
    }

    const lcname = name.toLowerCase();

    // Hardcoded icons
    switch (lcname) {
        case 'zen-beta':
        case 'zen-alpha':
            return Bicon({ name: "zen-white-symbolic", tooltip: tooltip });
        case 'jetbrains-datagrip':
            return Bicon({ name: "datagrip", tooltip: tooltip });
        case 'jetbrains-idea-ce':
            return Bicon({ name: "idea", tooltip: tooltip });
        case 'onlyoffice desktop editors':
            return Bicon({ name: "onlyoffice-desktopeditors", tooltip: tooltip });
        case 'vesktop':
            if (symbolic) {
                return Bicon({ name: "discord-tray", tooltip: tooltip });
            }
            
            return Bicon({ name: "discord", tooltip: tooltip });
        case 'syncthing':
            return Bicon({ name: "si-syncthing-2", tooltip: tooltip });
    }

    // Try to find icon in iconpack
    const iconPath = Astal.Icon.lookup_icon(lcname)?.get_filename()
    if (iconPath) {
        return new Widget.Icon({
            icon: iconPath,
            tooltip_text: tooltip ? tooltip : "",
        })
    }

    return new Widget.Icon({
        icon: 'item-missing-symbolic'
    })
}