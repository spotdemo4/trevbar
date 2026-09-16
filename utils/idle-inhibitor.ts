import { readFile, writeFile } from "ags/file";
import GObject, { getter, register } from "ags/gobject";
import app from "ags/gtk4/app";
import { subprocess } from "ags/process";
import GLib from "gi://GLib?version=2.0";

const command = [
  "systemd-inhibit",
  "--what=idle",
  "--who=trevbar",
  "--why=trevbar idle inhibitor",
  "--mode=block",
  "sleep",
  "infinity",
];
const stateFile = GLib.build_filenamev([
  GLib.get_user_state_dir(),
  "trevbar",
  "idle-inhibitor-enabled",
]);

@register({ GTypeName: "IdleInhibitor" })
export default class IdleInhibitor extends GObject.Object {
  static instance: IdleInhibitor;

  static get_default() {
    if (!this.instance) this.instance = new IdleInhibitor();

    return this.instance;
  }

  #enabled = false;
  #inhibited = false;
  #process: ReturnType<typeof subprocess> | null = null;

  @getter(Boolean)
  get enabled() {
    return this.#enabled;
  }

  @getter(Boolean)
  get inhibited() {
    return this.#inhibited;
  }

  constructor() {
    super();

    this.#enabled = this.#loadEnabled();
    app.connect("shutdown", () => this.stop());

    if (this.#enabled) this.start();
  }

  start() {
    if (this.#process) return;

    try {
      const process = subprocess(command, undefined, (error) => {
        console.error("Idle inhibitor error", error);
      });

      this.#process = process;
      this.#setInhibited(true);

      process.connect("exit", () => {
        if (this.#process !== process) return;

        this.#process = null;
        this.#setInhibited(false);
      });
    } catch (error) {
      console.error("Failed to start idle inhibitor", error);
      this.#setInhibited(false);
    }
  }

  stop() {
    const process = this.#process;
    this.#process = null;
    process?.kill();
    this.#setInhibited(false);
  }

  toggle() {
    const enabled = !this.#enabled;
    this.#setEnabled(enabled);

    try {
      writeFile(stateFile, `${enabled}\n`);
    } catch (error) {
      console.error("Failed to save idle inhibitor state", error);
    }

    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  #loadEnabled() {
    if (!GLib.file_test(stateFile, GLib.FileTest.EXISTS)) return false;

    try {
      const enabled = readFile(stateFile).trim();
      if (enabled === "true") return true;
      if (enabled === "false") return false;

      console.warn("Invalid idle inhibitor state", enabled);
    } catch (error) {
      console.warn("Failed to read idle inhibitor state", error);
    }

    return false;
  }

  #setEnabled(enabled: boolean) {
    if (this.#enabled === enabled) return;

    this.#enabled = enabled;
    this.notify("enabled");
  }

  #setInhibited(inhibited: boolean) {
    if (this.#inhibited === inhibited) return;

    this.#inhibited = inhibited;
    this.notify("inhibited");
  }
}
