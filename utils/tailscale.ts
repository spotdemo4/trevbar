import GObject, { getter, register } from 'ags/gobject';
import { exec } from 'ags/process';
import { interval } from 'ags/time';

@register({ GTypeName: 'Tailscale' })
export default class Tailscale extends GObject.Object {
	static instance: Tailscale;

	static get_default() {
		if (!this.instance) this.instance = new Tailscale();

		return this.instance;
	}

	#connected = false;

	@getter(Boolean)
	get connected() {
		return this.#connected;
	}

	constructor() {
		super();

		interval(5000, () => {
			try {
				exec('tailscale status');

				if (!this.#connected) {
					this.#connected = true;
					this.notify('connected');
				}
			} catch (e) {
				if (this.#connected) {
					this.#connected = false;
					this.notify('connected');
				}

				return;
			}
		});
	}
}
