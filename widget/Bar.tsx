import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk3"
import { Variable, GLib, bind } from "astal"
import { getHyprlandMonitor } from "../utils/utils"
import Hyprland from "gi://AstalHyprland"
// import Mpris from "gi://AstalMpris"
import Battery from "gi://AstalBattery"
import Wp from "gi://AstalWp"
import Network from "gi://AstalNetwork"
import Tray from "gi://AstalTray"
import GTop from "gi://GTop?version=2.0"
//import Bluetooth from "gi://AstalBluetooth"

export default function Bar(gdkmonitor: Gdk.Monitor) {
    return <window
        className="Bar"
        gdkmonitor={gdkmonitor}
        exclusivity={Astal.Exclusivity.EXCLUSIVE}
        anchor={Astal.WindowAnchor.TOP
            | Astal.WindowAnchor.LEFT
            | Astal.WindowAnchor.RIGHT}
        application={App}>
        <centerbox>
            <box hexpand halign={Gtk.Align.START}>
                <Workspaces monitor={gdkmonitor} />
            </box>
            <box>
                <Title />
            </box>
            <box hexpand halign={Gtk.Align.END} className="Bar-right">
                <MemoryUsage />
                <CpuUsage />
                <BatteryLevel />
                <Wifi />
                <AudioSlider />
                <SysTray />
                <Time />
            </box>
        </centerbox>
    </window>
}

function Workspaces({ monitor }: { monitor: Gdk.Monitor }): JSX.Element {
    const hypr = Hyprland.get_default()

    return <box className="Workspaces">
        {bind(hypr, "workspaces").as(wss => wss
            .filter(ws => getHyprlandMonitor(monitor) === ws.get_monitor())
            .sort((a, b) => a.id - b.id)
            .map(ws => (
                <button
                    className={bind(hypr, "focusedWorkspace").as(fw =>
                        ws === fw ? "focused" : "")}
                    valign={Gtk.Align.CENTER}
                    halign={Gtk.Align.CENTER}
                    tooltipMarkup={`<b>${ws.get_name()}</b>`}
                    onClicked={() => ws.focus()}>
                    {ws.id}
                </button>
            ))
        )}
    </box>
}

function Title(): JSX.Element {
    const hypr = Hyprland.get_default()
    const focused = bind(hypr, "focusedClient")

    return <box
        className="blur title"
        visible={focused.as(Boolean)}>
        {focused.as(client => {
            if (!client) {
                return "";
            }

            const icon = Gtk.IconTheme.get_default().lookup_icon(client.initial_class.toLowerCase(), 32, null)?.get_filename()

            if (icon) {
                return <icon icon={icon} />
            } else {
                return "";
            }
        }
        )}
        {focused.as(client => (
            client && <label label={bind(client, "title").as(String)} />
        ))}
    </box>
}

function SysTray() {
    const tray = Tray.get_default()

    return <box className="Tray">
        {bind(tray, "items").as(items => items.map(item => {
            if (item.iconThemePath) {
                App.add_icons(item.iconThemePath)
            }

            const menu = item.create_menu()

            return <button
                tooltipMarkup={bind(item, "tooltipMarkup")}
                onDestroy={() => menu?.destroy()}
                onClickRelease={self => {
                    menu?.popup_at_widget(self, Gdk.Gravity.SOUTH, Gdk.Gravity.NORTH, null)
                }}
            >
                <icon gIcon={bind(item, "gicon")} />
            </button>
        }))}
    </box>
}

function AudioSlider() {
    const speaker = Wp.get_default()?.audio.defaultSpeaker!
    const show = Variable(false)

    return <box className="AudioSlider">
        <button
            onClickRelease={_ => {
                show.set(!show.get())
            }}
        >
            <icon icon={bind(speaker, "volumeIcon")} />
        </button>
        <slider
            visible={bind(show).as(Boolean)}
            className="slider"
            hexpand
            onDragged={({ value }) => speaker.volume = value}
            value={bind(speaker, "volume")}
        />
    </box>
}

function Wifi() {
    const { wifi } = Network.get_default()

    return <icon
        visible={bind(wifi, "ssid").as(Boolean)}
        tooltipText={bind(wifi, "ssid").as(String)}
        className="Wifi"
        icon={bind(wifi, "iconName")}
    />
}

// function Media() {
//     const mpris = Mpris.get_default()

//     return <box className="Media" visible={bind(mpris, "players").as(ps => ps.length > 0)}>
//         {bind(mpris, "players").as(ps => ps[0] ? (
//             <box>
//                 <label
//                     label={bind(ps[0], "title").as(() =>
//                         `${ps[0].title} - ${ps[0].artist}`
//                     )}
//                 />
//             </box>
//         ) : (""))}
//     </box>
// }

function BatteryLevel() {
    const bat = Battery.get_default()

    return <box className="Battery"
        visible={bind(bat, "isPresent")}>
        <icon icon={bind(bat, "batteryIconName")} />
        <label label={bind(bat, "percentage").as(p =>
            `${Math.floor(p * 100)} %`
        )} />
    </box>
}

function Time({ format = "%H:%M" }): JSX.Element {
    const time = Variable<string>("").poll(1000, () =>
        GLib.DateTime.new_now_local().format(format)!)

    return <box className="time">
        <label
            className="Time"
            onDestroy={() => time.drop()}
            label={time()}
        />
    </box>
}

function CpuUsage(): JSX.Element {
    const cpu = new GTop.glibtop_cpu();
    GTop.glibtop_get_cpu(cpu);

    let prevUser = cpu.user;
    let prevIdle = cpu.idle;
    let prevTotal = cpu.total;

    const cpuTotal = Variable<number>(0).poll(2000, () => {
        GTop.glibtop_get_cpu(cpu);
        let userDelta = cpu.user - prevUser;
        let idleDelta = cpu.idle - prevIdle;
        let totalDelta = cpu.total - prevTotal;
        let idleUsage = Math.round(100 * idleDelta / totalDelta);
        let userUsage = Math.round(100 * userDelta / totalDelta);

        let user = userUsage;
        let system = 100 - userUsage - idleUsage;
        let total = user + system;

        prevUser = cpu.user;
        prevIdle = cpu.idle;
        prevTotal = cpu.total;

        return total;
    });

    const icon = Gtk.IconTheme.get_default().lookup_icon('cpu', 32, null)?.get_filename();

    return <box className="CpuUsage">
        {icon && <icon icon={icon} />}
        <label label={bind(cpuTotal).as(t => t.toString() + '%')} />
    </box>
}

function MemoryUsage(): JSX.Element {
    const memory = new GTop.glibtop_mem();

    const memoryTotal = Variable<number>(0).poll(2000, () => {
        GTop.glibtop_get_mem(memory);

        return Math.round((memory.free / memory.total) * 100);
    });

    const icon = Gtk.IconTheme.get_default().lookup_icon('media-memory', 32, null)?.get_filename();

    return <box className="CpuUsage">
        {icon && <icon icon={icon} />}
        <label label={bind(memoryTotal).as(t => t.toString() + '%')} />
    </box>
}

