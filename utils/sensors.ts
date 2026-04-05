import GObject, { getter, register } from "ags/gobject";
import { interval } from "ags/time";
import { execAsync } from "ags/process";

type SensorsInfo = {
	"coretemp-isa-0000"?: {
		"Package id 0": {
			temp1_input: number;
			temp1_max: number;
			temp1_crit: number;
			temp1_crit_alarm: number;
		};
	};
};

@register({ GTypeName: "Sensors" })
export default class Sensors extends GObject.Object {
	static instance: Sensors;

	static get_default() {
		if (!this.instance) this.instance = new Sensors();

		return this.instance;
	}

	#cpu_temp = 0;
	@getter(Number)
	get cpu_temp() {
		return this.#cpu_temp;
	}
	#cpu_max = 0;
	@getter(Number)
	get cpu_max() {
		return this.#cpu_max;
	}
	#cpu_crit = 0;
	@getter(Number)
	get cpu_crit() {
		return this.#cpu_crit;
	}

	constructor() {
		super();

		// Calculate GPU usage
		interval(2000, async () => {
			const raw = await execAsync("sensors -j");
			const info: SensorsInfo = JSON.parse(raw);

			if (info["coretemp-isa-0000"]) {
				const cpuInfo = info["coretemp-isa-0000"]["Package id 0"];

				if (cpuInfo.temp1_crit !== this.#cpu_crit) {
					this.#cpu_crit = cpuInfo.temp1_crit;
					this.notify("cpu_crit");
				}

				if (cpuInfo.temp1_max !== this.#cpu_max) {
					this.#cpu_max = cpuInfo.temp1_max;
					this.notify("cpu_max");
				}

				if (cpuInfo.temp1_input !== this.#cpu_temp) {
					this.#cpu_temp = cpuInfo.temp1_input;
					this.notify("cpu_temp");
				}
			}
		});
	}
}
