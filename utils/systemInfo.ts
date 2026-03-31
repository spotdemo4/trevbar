import GObject, { getter, register } from "ags/gobject";
import { interval } from "ags/time";
import GTop from "gi://GTop?version=2.0";

@register({ GTypeName: "SystemInfo" })
export default class SystemInfo extends GObject.Object {
	static instance: SystemInfo;
	static cpu: GTop.glibtop_cpu;
	static memory: GTop.glibtop_mem;

	static get_default() {
		if (!this.instance) this.instance = new SystemInfo();

		return this.instance;
	}

	#cpuUser = 0;
	@getter(Number)
	get cpu_user() {
		return this.#cpuUser;
	}

	#cpuSystem = 0;
	@getter(Number)
	get cpu_system() {
		return this.#cpuSystem;
	}

	#cpuTotal = 0;
	@getter(Number)
	get cpu_total() {
		return this.#cpuTotal;
	}

	#memUsed = 0;
	@getter(Number)
	get mem_used() {
		return this.#memUsed;
	}

	#memCached = 0;
	@getter(Number)
	get mem_cached() {
		return this.#memCached;
	}

	#memFree = 0;
	@getter(Number)
	get mem_free() {
		return this.#memFree;
	}

	#memUsage = 0;
	@getter(Number)
	get mem_usage() {
		return this.#memUsage;
	}

	constructor() {
		super();

		if (!SystemInfo.cpu) SystemInfo.cpu = new GTop.glibtop_cpu();

		if (!SystemInfo.memory) SystemInfo.memory = new GTop.glibtop_mem();

		// Calculate CPU usage
		GTop.glibtop_get_cpu(SystemInfo.cpu);
		let prevUser = SystemInfo.cpu.user;
		let prevIdle = SystemInfo.cpu.idle;
		let prevTotal = SystemInfo.cpu.total;
		interval(2000, () => {
			GTop.glibtop_get_cpu(SystemInfo.cpu);
			const userDelta = SystemInfo.cpu.user - prevUser;
			const idleDelta = SystemInfo.cpu.idle - prevIdle;
			const totalDelta = SystemInfo.cpu.total - prevTotal;
			const idleUsage = Math.round((100 * idleDelta) / totalDelta);
			const userUsage = Math.round((100 * userDelta) / totalDelta);

			const user = userUsage;
			this.#cpuUser = user;
			this.notify("cpu_user");

			const system = 100 - userUsage - idleUsage;
			this.#cpuSystem = system;
			this.notify("cpu_system");

			const total = user + system;
			this.#cpuTotal = total;
			this.notify("cpu_total");

			prevUser = SystemInfo.cpu.user;
			prevIdle = SystemInfo.cpu.idle;
			prevTotal = SystemInfo.cpu.total;
		});

		// Calculate memory usage
		interval(2000, () => {
			GTop.glibtop_get_mem(SystemInfo.memory);

			const cached = SystemInfo.memory.cached - SystemInfo.memory.shared;
			this.#memCached = cached;
			this.notify("mem_cached");

			const used = SystemInfo.memory.used - SystemInfo.memory.buffer - cached;
			this.#memUsed = used;
			this.notify("mem_used");

			// This is probably the wrong way of doing this https://unix.stackexchange.com/questions/499649/is-cached-memory-de-facto-free
			const free = SystemInfo.memory.free + SystemInfo.memory.buffer + cached;
			this.#memFree = free;
			this.notify("mem_free");

			const usage = Math.round((used / SystemInfo.memory.total) * 100);
			this.#memUsage = usage;
			this.notify("mem_usage");
		});
	}
}
