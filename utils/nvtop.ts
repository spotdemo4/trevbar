import GObject, { getter, register } from "ags/gobject";
import { interval } from "ags/time";
import { execAsync } from "ags/process";

type GpuInfo = {
	device_name: string;
	gpu_clock: string | null;
	mem_clock: string | null;
	temp: string | null;
	fan_speed: string | null;
	power_draw: string | null;
	gpu_util: string | null;
	encode_decode: string | null;
	mem_util: number | null;
	mem_total: number | null;
	mem_used: number | null;
	mem_free: number | null;
};

@register({ GTypeName: "NvTop" })
export default class NvTop extends GObject.Object {
	static instance: NvTop;

	static get_default() {
		if (!this.instance) this.instance = new NvTop();

		return this.instance;
	}

	#gpuUsage = 0;

	@getter(Number)
	get gpu_usage() {
		return this.#gpuUsage;
	}

	constructor() {
		super();

		// Calculate GPU usage
		interval(2000, async () => {
			const raw = await execAsync("nvtop -s");
			const info: GpuInfo[] = JSON.parse(raw);

			const first = info.at(0);
			if (!first) {
				return;
			}

			if (first.gpu_util) {
				this.#gpuUsage = parseInt(first.gpu_util);
				this.notify("gpu_usage");
			}
		});
	}
}
