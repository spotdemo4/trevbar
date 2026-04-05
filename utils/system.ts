import GObject, { getter, register } from "ags/gobject";
import { interval } from "ags/time";
import GTop from "gi://GTop?version=2.0";

@register({ GTypeName: "System" })
export default class System extends GObject.Object {
	static instance: System;
	static cpu: GTop.glibtop_cpu;
	static memory: GTop.glibtop_mem;
	static mount: GTop.glibtop_mountlist;
	static disk: GTop.glibtop_disk;

	static get_default() {
		if (!this.instance) this.instance = new System();

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

		if (!System.cpu) System.cpu = new GTop.glibtop_cpu();
		if (!System.memory) System.memory = new GTop.glibtop_mem();
		if (!System.disk) System.disk = new GTop.glibtop_disk();

		// Calculate CPU usage
		GTop.glibtop_get_cpu(System.cpu);
		let prevUser = System.cpu.user;
		let prevIdle = System.cpu.idle;
		let prevTotal = System.cpu.total;

		interval(2000, () => {
			GTop.glibtop_get_cpu(System.cpu);
			const userDelta = System.cpu.user - prevUser;
			const idleDelta = System.cpu.idle - prevIdle;
			const totalDelta = System.cpu.total - prevTotal;
			const idleUsage = Math.round((100 * idleDelta) / totalDelta);
			const userUsage = Math.round((100 * userDelta) / totalDelta);

			const user = userUsage;
			if (user !== this.#cpuUser) {
				this.#cpuUser = user;
				this.notify("cpu_user");
			}

			const system = 100 - userUsage - idleUsage;
			if (system !== this.#cpuSystem) {
				this.#cpuSystem = system;
				this.notify("cpu_system");
			}

			const total = user + system;
			if (total !== this.#cpuTotal) {
				this.#cpuTotal = total;
				this.notify("cpu_total");
			}

			prevUser = System.cpu.user;
			prevIdle = System.cpu.idle;
			prevTotal = System.cpu.total;
		});

		// Calculate memory usage
		interval(2000, () => {
			GTop.glibtop_get_mem(System.memory);

			const cached = System.memory.cached - System.memory.shared;
			if (cached !== this.#memCached) {
				this.#memCached = cached;
				this.notify("mem_cached");
			}

			const used = System.memory.used - System.memory.buffer - cached;
			if (used !== this.#memUsed) {
				this.#memUsed = used;
				this.notify("mem_used");
			}

			// This is probably the wrong way of doing this https://unix.stackexchange.com/questions/499649/is-cached-memory-de-facto-free
			const free = System.memory.free + System.memory.buffer + cached;
			if (free !== this.#memFree) {
				this.#memFree = free;
				this.notify("mem_free");
			}

			const usage = Math.round((used / System.memory.total) * 100);
			if (usage !== this.#memUsage) {
				this.#memUsage = usage;
				this.notify("mem_usage");
			}
		});
	}
}
