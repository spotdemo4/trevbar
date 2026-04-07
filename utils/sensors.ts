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
	"k10temp-pci-00c3"?: {
		Tccd1: {
			temp3_input: number;
		};
	};
	"nvme-pci-0100"?: {
		Composite: {
			temp1_input: number;
			temp1_max: number;
			temp1_crit: number;
		};
	};
	"nct6798-isa-0290"?: {
		SYSTIN: {
			temp1_input: number;
			temp1_max: number;
			temp1_crit: number;
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
	#cpu_max = 90;
	@getter(Number)
	get cpu_max() {
		return this.#cpu_max;
	}
	#cpu_crit = 100;
	@getter(Number)
	get cpu_crit() {
		return this.#cpu_crit;
	}

	#mem_temp = 0;
	@getter(Number)
	get mem_temp() {
		return this.#mem_temp;
	}
	#mem_max = 90;
	@getter(Number)
	get mem_max() {
		return this.#mem_max;
	}
	#mem_crit = 100;
	@getter(Number)
	get mem_crit() {
		return this.#mem_crit;
	}

	#disk_temp = 0;
	@getter(Number)
	get disk_temp() {
		return this.#disk_temp;
	}
	#disk_max = 90;
	@getter(Number)
	get disk_max() {
		return this.#disk_max;
	}
	#disk_crit = 100;
	@getter(Number)
	get disk_crit() {
		return this.#disk_crit;
	}

	constructor() {
		super();

		// Get temperatures
		interval(2000, async () => {
			const raw = await execAsync("sensors -j");
			const info: SensorsInfo = JSON.parse(raw);

			// cpu
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
			} else if (info["k10temp-pci-00c3"]) {
				const cpuInfo = info["k10temp-pci-00c3"]["Tccd1"];

				if (cpuInfo.temp3_input !== this.#cpu_temp) {
					this.#cpu_temp = cpuInfo.temp3_input;
					this.notify("cpu_temp");
				}
			}

			// memory
			if (info["nct6798-isa-0290"]) {
				const memInfo = info["nct6798-isa-0290"]["SYSTIN"];

				if (memInfo.temp1_crit !== this.#mem_crit) {
					this.#mem_crit = memInfo.temp1_crit;
					this.notify("mem_crit");
				}

				if (memInfo.temp1_max !== this.#mem_max) {
					this.#mem_max = memInfo.temp1_max;
					this.notify("mem_max");
				}

				if (memInfo.temp1_input !== this.#mem_temp) {
					this.#mem_temp = memInfo.temp1_input;
					this.notify("mem_temp");
				}
			}

			// disk
			if (info["nvme-pci-0100"]) {
				const diskInfo = info["nvme-pci-0100"]["Composite"];

				if (diskInfo.temp1_crit !== this.#disk_crit) {
					this.#disk_crit = diskInfo.temp1_crit;
					this.notify("disk_crit");
				}

				if (diskInfo.temp1_max !== this.#disk_max) {
					this.#disk_max = diskInfo.temp1_max;
					this.notify("disk_max");
				}

				if (diskInfo.temp1_input !== this.#disk_temp) {
					this.#disk_temp = diskInfo.temp1_input;
					this.notify("disk_temp");
				}
			}
		});
	}
}
