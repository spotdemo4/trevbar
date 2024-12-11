import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk3"
import { Variable, GLib, bind, exec, execAsync, Binding } from "astal"
import { getHyprlandMonitor, sortByMaster, sleep, Bicon, doesBiconExist } from "../utils/utils"
import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import Wp from "gi://AstalWp"
import Tray from "gi://AstalTray"
import GTop from "gi://GTop?version=2.0"
import Soup from "gi://Soup?version=3.0"
import { Subscribable } from "astal/binding"

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
                <MemoryUsage />
                <CpuUsage />
                <BatteryUsage />
                <Syncthing />
                <Tailscale />
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
                    cursor="pointer"
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
                return <Bicon name={client.initialClass} tooltip={client.title} />
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

            return <Bicon name={client.initialClass} />
        })}
        {focused.as(client => (
            client && <label valign={Gtk.Align.CENTER} label={bind(client, "title").as(String)} />
        ))}
    </box>
}

function SysTray(): JSX.Element {
    const tray = Tray.get_default()

    return <box className="tray">
        {bind(tray, "items").as(items => items.map(item => {
            if (item.iconThemePath) {
                App.add_icons(item.iconThemePath)
            }

            const menu = item.create_menu()
            const name =
                item.title != "" ? item.title :
                    item.tooltipMarkup != "" ? item.tooltipMarkup :
                        item.id != "" ? item.id : ''

            return <button
                tooltipMarkup={bind(item, "tooltipMarkup")}
                onDestroy={() => menu?.destroy()}
                cursor="pointer"
                onClickRelease={self => {
                    menu?.popup_at_widget(self, Gdk.Gravity.SOUTH, Gdk.Gravity.NORTH, null)
                }}
            >
                {doesBiconExist(name) ? <Bicon name={name} tooltip={name} symbolic={true} /> : <icon gIcon={bind(item, "gicon")} />}
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

    return <box className="audio-slider">
        <button
            onClickRelease={() => show.set(!show.get())}
            cursor="pointer"
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

function BatteryUsage() {
    const bat = Battery.get_default()

    const percentage = bind(bat, "percentage").as((n) => n * 100);

    const widget = <button
        visible={bind(bat, "isPresent")}
    >
        <icon icon={bind(bat, "batteryIconName")} />
    </button>

    return Percentage(widget, percentage);
}

function Time(): JSX.Element {
    const time = Variable<string>("").poll(1000, () =>
        GLib.DateTime.new_now_local().format("%H:%M")!)

    const date = Variable<string>("").poll(60 * 1000, () =>
        GLib.DateTime.new_now_local().format("%d/%m/%Y")!)

    let showDate = Variable<boolean>(false)

    return <box>
        <button
            onClickRelease={() => showDate.set(!showDate.get())}
            onDestroy={() => {
                time.drop();
                date.drop()
                showDate.drop()
            }}
            cursor="pointer"
        >
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

    const button = <button
        onClickRelease={_ => execAsync('kitty btop')}
        cursor="pointer"
    >
        <icon tooltip_text="CPU Usage" className="symbol" icon='processor-symbolic' />
    </button>

    return Percentage(button, cpuTotal);
}

function MemoryUsage(): JSX.Element {
    const memory = new GTop.glibtop_mem();

    const memoryTotal = Variable<number>(0).poll(2000, () => {
        GTop.glibtop_get_mem(memory);

        // This is the wrong way of doing this https://unix.stackexchange.com/questions/499649/is-cached-memory-de-facto-free
        const availableUsed = memory.used - memory.cached;

        return Math.round((availableUsed / memory.total) * 100);
    });

    const button = <button
        onClickRelease={_ => execAsync('kitty btop')}
        cursor="pointer"
    >
        <icon tooltipText="Memory Usage" className="symbol" icon='memory-symbolic' />
    </button>

    return Percentage(button, memoryTotal)
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
        <button
            onClickRelease={_ => execAsync('xdg-open https://login.tailscale.com/admin/machines')}
            className={bind(isConnected).as(t => t ? "healthy" : "unhealthy")}
            cursor="pointer"
        >
            <Bicon name="tailscale" tooltip="Tailscale" />
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
        <button
            onClickRelease={_ => execAsync("xdg-open http://localhost:8384/")}
            className={bind(isConnected).as(t => t ? "healthy" : "unhealthy")}
            cursor="pointer"
        >
            <Bicon name="syncthing" tooltip="Syncthing" />
        </button>
    </box>
}

function Percentage(widget: Gtk.Widget, num: Subscribable<number>) {
    const blocksCSS = new Map<string, Variable<string>>();
    const table = Gtk.Table.new(3, 3, true)
    table.name = "table";
    table.visible = true;
    table.widthRequest = 32;

    // For each column
    for (let i = 0; i <= 2; i++) {
        // For each row
        for (let j = 0; j <= 2; j++) {
            let cssvar: Variable<string>;
            if (blocksCSS.has(`${i}-${j}`)) {
                cssvar = blocksCSS.get(`${i}-${j}`)!
            } else {
                cssvar = Variable("");
                blocksCSS.set(`${i}-${j}`, cssvar);
            }

            const box = new Widget.Box({
                name: `block-${i}-${j}`,
                className: bind(cssvar).as((css) => css)
            });

            table.attach_defaults(box, i, i + 1, j, j + 1)
        }
    }

    const Overlay = Astal.Overlay.new();
    Overlay.name = "percentage";
    Overlay.set_child(table);
    Overlay.add_overlay(widget);
    Overlay.visible = true;

    const calculate = (num: number) => {
        const outof12 = Math.floor(num / 8.333333333333334);

        // Bottom left 0-2
        if (outof12 >= 12) {
            blocksCSS.get("0-2")?.set("bottom left")
        } else if (outof12 >= 1) {
            blocksCSS.get("0-2")?.set("nbottom left")
        } else {
            blocksCSS.get("0-2")?.set("nbottom nleft")
        }

        // Bottom 1-2
        if (outof12 >= 11) {
            blocksCSS.get("1-2")?.set("bottom")
        } else {
            blocksCSS.get("1-2")?.set("nbottom")
        }

        // Bottom right 2-2
        if (outof12 >= 10) {
            blocksCSS.get("2-2")?.set("bottom right")
        } else if (outof12 >= 9) {
            blocksCSS.get("2-2")?.set("nbottom right")
        } else {
            blocksCSS.get("2-2")?.set("nbottom nright")
        }

        // Right 2-1
        if (outof12 >= 8) {
            blocksCSS.get("2-1")?.set("right")
        } else {
            blocksCSS.get("2-1")?.set("nright")
        }

        // Top right 2-0
        if (outof12 >= 7) {
            blocksCSS.get("2-0")?.set("top right")
        } else if (outof12 >= 6) {
            blocksCSS.get("2-0")?.set("top nright")
        } else {
            blocksCSS.get("2-0")?.set("ntop nright")
        }

        // Top 1-0
        if (outof12 >= 5) {
            blocksCSS.get("1-0")?.set("top")
        } else {
            blocksCSS.get("1-0")?.set("ntop")
        }

        // Top left 0-0
        if (outof12 >= 4) {
            blocksCSS.get("0-0")?.set("top left")
        } else if (outof12 >= 3) {
            blocksCSS.get("0-0")?.set("ntop left")
        } else {
            blocksCSS.get("0-0")?.set("ntop nleft")
        }

        // Left 0-1
        if (outof12 >= 2) {
            blocksCSS.get("0-1")?.set("left")
        } else {
            blocksCSS.get("0-1")?.set("nleft")
        }
    }

    num.subscribe((num) => {
        calculate(num);
    })

    calculate(num.get());

    return <box className="overlay">
        {Overlay}
    </box>;
}