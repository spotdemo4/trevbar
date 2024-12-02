import { App, Astal, Gtk, Gdk } from "astal/gtk3"
import { Variable, GLib, bind, exec, execAsync, signal } from "astal"
import { getHyprlandMonitor, sortByMaster, sleep, getIcon } from "../utils/utils"
import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import Wp from "gi://AstalWp"
import Network from "gi://AstalNetwork"
import Tray from "gi://AstalTray"
import GTop from "gi://GTop?version=2.0"
import Soup from "gi://Soup?version=3.0"

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
            <box hexpand halign={Gtk.Align.START} className="left">
                <Workspaces monitor={gdkmonitor} />
            </box>
            <box className="center">
                <Title />
            </box>
            <box hexpand halign={Gtk.Align.END} className="right">
                <Syncthing />
                <Tailscale />
                <MemoryUsage />
                <CpuUsage />
                <AudioSlider />
                <SysTray />
                <Time />
            </box>
        </centerbox>
    </window>
}

function Workspaces({ monitor }: { monitor: Gdk.Monitor }): JSX.Element {
    const hypr = Hyprland.get_default()

    return <box className="workspaces">
        {bind(hypr, "workspaces").as(wss => wss
            .filter(ws => getHyprlandMonitor(monitor) === ws.get_monitor())
            .sort((a, b) => a.id - b.id)
            .map(ws => {
                return <button
                    onClicked={() => ws.focus()}
                    tooltipMarkup={`<b>Workspace ${ws.name}</b>`}
                    className={bind(hypr, "focusedWorkspace").as(fw => ws === fw ? "focused" : "")}
                >
                    <Workspace workspace={ws} />
                </button>
            })
        )}
    </box>
}

function Workspace({ workspace }: { workspace: Hyprland.Workspace }) {
    const hypr = Hyprland.get_default()
    const clients = Variable(hypr.get_clients().filter((c) => c.workspace.id === workspace.id))

    hypr.connect('client-added', (_, c) => {
        if (c.workspace.id === workspace.id) {
            clients.set([...clients.get(), c]);
        }
    });

    hypr.connect('client-removed', (_, c) => {
        const newClients = clients.get().filter(client => client.address != c)
        if (newClients !== clients.get()) {
            clients.set([...newClients]);
        }
    });

    hypr.connect('client-moved', (hy, _) => {
        clients.set(hy.get_clients().filter((client) => client.workspace.id === workspace.id))
    })

    return <box>
        {bind(clients).as(clients => sortByMaster(clients)
            .map(client => {
                const icon = getIcon(client.initialClass);
                return <icon icon={icon} />
            }))}
    </box>
}

function Title(): JSX.Element {
    const hypr = Hyprland.get_default()
    const focused = bind(hypr, "focusedClient")

    return <box
        className="title"
        visible={focused.as(Boolean)}>
        {focused.as(client => {
            if (!client) {
                return "";
            }

            const icon = getIcon(client.initialClass);

            if (icon) {
                return <icon icon={icon} />
            }

            return "";
        })}
        {focused.as(client => (
            client && <label label={bind(client, "title").as(String)} />
        ))}
    </box>
}

function SysTray() {
    const tray = Tray.get_default()

    return <box className="tray">
        {bind(tray, "items").as(items => items.map(item => {
            if (item.iconThemePath) {
                App.add_icons(item.iconThemePath)
            }

            const icon = getIcon(item.iconName);
            const menu = item.create_menu()

            return <button
                tooltipMarkup={bind(item, "tooltipMarkup")}
                onDestroy={() => menu?.destroy()}
                onClickRelease={self => {
                    menu?.popup_at_widget(self, Gdk.Gravity.SOUTH, Gdk.Gravity.NORTH, null)
                }}
            >
                {icon ? <icon icon={icon} /> : <icon gIcon={bind(item, "gicon")} />}
            </button>
        }))}
    </box>
}

function AudioSlider() {
    const speaker = Wp.get_default()?.audio.defaultSpeaker!
    const show = Variable(false)
    const visible = Variable(false)

    show.subscribe(async (s) => {
        if (s) {
            visible.set(s);
        } else {
            await sleep(250);
            visible.set(s);
        }
    })

    return <box>
        <button
            onClickRelease={() => show.set(!show.get())}
        >
            <icon icon={bind(speaker, "volumeIcon")} />
        </button>
        <slider
            className={bind(show).as(show => show ? "slider show" : "slider hide")}
            visible={bind(visible).as(Boolean)}
            hexpand
            onDragged={({ value }) => speaker.volume = value}
            value={bind(speaker, "volume")}
        />
    </box>
}

// function Wifi() {
//     const { wifi } = Network.get_default()

//     return <icon
//         visible={bind(wifi, "ssid").as(Boolean)}
//         tooltipText={bind(wifi, "ssid").as(String)}
//         className="Wifi"
//         icon={bind(wifi, "iconName")}
//     />
// }

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

// function BatteryLevel() {
//     const bat = Battery.get_default()

//     return <box className="Battery"
//         visible={bind(bat, "isPresent")}>
//         <icon icon={bind(bat, "batteryIconName")} />
//         <label label={bind(bat, "percentage").as(p =>
//             `${Math.floor(p * 100)} %`
//         )} />
//     </box>
// }

function Time(): JSX.Element {
    const time = Variable<string>("").poll(1000, () =>
        GLib.DateTime.new_now_local().format("%H:%M")!)

    const date = Variable<string>("").poll(60 * 1000, () =>
        GLib.DateTime.new_now_local().format("%d/%m/%Y")!)

    let showDate = Variable<boolean>(false)

    return <box>
        <button onClickRelease={() => showDate.set(!showDate.get())} onDestroy={() => {
            time.drop();
            date.drop()
            showDate.drop()
        }}>
            {bind(showDate).as(show => show ?
                <label label={date()} /> :
                <label label={time()} />
            )}
        </button>
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

    return <box>
        <button onClickRelease={_ => execAsync('kitty btop')}>
            <box>
                <icon icon='processor-symbolic' />
                <label label={bind(cpuTotal).as(t => t.toString() + '%')} onDestroy={() => cpuTotal.drop()} />
            </box>
        </button>
    </box>
}

function MemoryUsage(): JSX.Element {
    const memory = new GTop.glibtop_mem();

    const memoryTotal = Variable<number>(0).poll(2000, () => {
        GTop.glibtop_get_mem(memory);

        // This is the wrong way of doing this https://unix.stackexchange.com/questions/499649/is-cached-memory-de-facto-free
        const availableUsed = memory.used - memory.cached;

        return Math.round((availableUsed / memory.total) * 100);
    });

    return <box>
        <button onClickRelease={_ => execAsync('kitty btop')}>
            <box>
                <icon icon='memory-symbolic' />
                <label label={bind(memoryTotal).as(t => t.toString() + '%')} onDestroy={() => memoryTotal.drop()} />
            </box>
        </button>
    </box>
}

function Tailscale(): JSX.Element {
    const isConnected = Variable<boolean>(false).poll(2000, () => {
        try {
            exec('tailscale status')

            return true;
        } catch (_) {
            return false;
        }
    })

    return <box>
        <button onClickRelease={_ => execAsync('xdg-open https://login.tailscale.com/admin/machines')}>
            <icon icon="interlinked-rectangles-symbolic" tooltipMarkup={`<b>Tailscale</b>`} css={bind(isConnected).as(t => t ? "color: #39FF14;" : "color: #ff073a;")} />
        </button>
    </box>
}

function Syncthing(): JSX.Element {
    const isConnected = Variable<boolean>(false).poll(2000, async () => {
        let json: { status: string };

        try {
            const session = new Soup.Session();
            const message = new Soup.Message({
                method: "GET",
                uri: GLib.Uri.parse("http://localhost:8384/rest/noauth/health", GLib.UriFlags.NONE)
            })

            const response = session.send_and_read(message, null).toArray();
            const responseData = new TextDecoder('utf-8').decode(response);
            json = JSON.parse(responseData);
        } catch (e) {
            return false;
        }

        if (json.status === "OK") {
            return true;
        } else {
            return false;
        }
    })

    return <box>
        <button onClickRelease={_ => execAsync("xdg-open http://localhost:8384/")}>
            <icon icon="network-server-symbolic" tooltipMarkup={`<b>Syncthing</b>`} css={bind(isConnected).as(t => t ? "color: #39FF14;" : "color: #ff073a;")} />
        </button>
    </box>
}

