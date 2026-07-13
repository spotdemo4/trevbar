import GObject, { getter, register } from "ags/gobject";
import app from "ags/gtk4/app";
import { subprocess } from "ags/process";

const command = [
  "systemd-inhibit",
  "--what=idle",
  "--who=trevbar",
  "--why=trevbar idle inhibitor",
  "--mode=block",
  "sleep",
  "infinity",
];

@register({ GTypeName: "IdleInhibitor" })
export default class IdleInhibitor extends GObject.Object {
  static instance: IdleInhibitor;

  static get_default() {
    if (!this.instance) this.instance = new IdleInhibitor();

    return this.instance;
  }

  #inhibited = false;
  #process: ReturnType<typeof subprocess> | null = null;

  @getter(Boolean)
  get inhibited() {
    return this.#inhibited;
  }

  constructor() {
    super();

    app.connect("shutdown", () => this.stop());
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
    if (this.#inhibited) {
      this.stop();
    } else {
      this.start();
    }
  }

  #setInhibited(inhibited: boolean) {
    if (this.#inhibited === inhibited) return;

    this.#inhibited = inhibited;
    this.notify("inhibited");
  }
}
