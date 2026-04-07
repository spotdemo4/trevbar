import GObject, { getter, register } from "ags/gobject";
import { interval } from "ags/time";
import GTop from "gi://GTop?version=2.0";

@register({ GTypeName: "System" })
export default class System extends GObject.Object {
	static instance: System;
	static cpu: GTop.glibtop_cpu;
	static memory: GTop.glibtop_mem;
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
	#cpuIOWait = 0;
	@getter(Number)
	get cpu_iowait() {
		return this.#cpuIOWait;
	}
	#cpuIrq = 0;
	@getter(Number)
	get cpu_irq() {
		return this.#cpuIrq;
	}
	#cpuSoftIrq = 0;
	@getter(Number)
	get cpu_softirq() {
		return this.#cpuSoftIrq;
	}
	#cpuNice = 0;
	@getter(Number)
	get cpu_nice() {
		return this.#cpuNice;
	}
	#cpuTotal = 0;
	@getter(Number)
	get cpu_total() {
		return this.#cpuTotal;
	}

	#memCached = 0;
	@getter(Number)
	get mem_cached() {
		return this.#memCached;
	}
	#memUsed = 0;
	@getter(Number)
	get mem_used() {
		return this.#memUsed;
	}
	#memFree = 0;
	@getter(Number)
	get mem_free() {
		return this.#memFree;
	}
	#memAvailable = 0;
	@getter(Number)
	get mem_available() {
		return this.#memAvailable;
	}
	#memUsage = 0;
	@getter(Number)
	get mem_usage() {
		return this.#memUsage;
	}

	#diskRead = 0;
	@getter(Number)
	get disk_read() {
		return this.#diskRead;
	}
	#diskWrite = 0;
	@getter(Number)
	get disk_write() {
		return this.#diskWrite;
	}

	constructor() {
		super();

		if (!System.cpu) System.cpu = new GTop.glibtop_cpu();
		if (!System.memory) System.memory = new GTop.glibtop_mem();
		if (!System.disk) System.disk = new GTop.glibtop_disk();

		// Calculate CPU usage
		GTop.glibtop_get_cpu(System.cpu);
		let prevUser = System.cpu.user;
		let prevSystem = System.cpu.sys;
		let prevIOWait = System.cpu.iowait;
		let prevIrq = System.cpu.irq;
		let prevSoftIrq = System.cpu.softirq;
		let prevNice = System.cpu.nice;
		let prevIdle = System.cpu.idle;
		let prevTotal = System.cpu.total;

		interval(2000, () => {
			GTop.glibtop_get_cpu(System.cpu);

			const userDelta = System.cpu.user - prevUser;
			const systemDelta = System.cpu.sys - prevSystem;
			const ioWaitDelta = System.cpu.iowait - prevIOWait;
			const irqDelta = System.cpu.irq - prevIrq;
			const softIrqDelta = System.cpu.softirq - prevSoftIrq;
			const niceDelta = System.cpu.nice - prevNice;
			const idleDelta = System.cpu.idle - prevIdle;
			const totalDelta = System.cpu.total - prevTotal;

			prevUser = System.cpu.user;
			prevSystem = System.cpu.sys;
			prevIOWait = System.cpu.iowait;
			prevIrq = System.cpu.irq;
			prevSoftIrq = System.cpu.softirq;
			prevNice = System.cpu.nice;
			prevIdle = System.cpu.idle;
			prevTotal = System.cpu.total;

			const userUsage = (userDelta / totalDelta) * 100;
			const systemUsage = (systemDelta / totalDelta) * 100;
			const ioWaitUsage = (ioWaitDelta / totalDelta) * 100;
			const irqUsage = (irqDelta / totalDelta) * 100;
			const softIrqUsage = (softIrqDelta / totalDelta) * 100;
			const niceUsage = (niceDelta / totalDelta) * 100;
			const idleUsage = (idleDelta / totalDelta) * 100;

			if (userUsage !== this.#cpuUser) {
				this.#cpuUser = userUsage;
				this.notify("cpu_user");
			}

			if (systemUsage !== this.#cpuSystem) {
				this.#cpuSystem = systemUsage;
				this.notify("cpu_system");
			}

			if (ioWaitUsage !== this.#cpuIOWait) {
				this.#cpuIOWait = ioWaitUsage;
				this.notify("cpu_iowait");
			}

			if (irqUsage !== this.#cpuIrq) {
				this.#cpuIrq = irqUsage;
				this.notify("cpu_irq");
			}

			if (softIrqUsage !== this.#cpuSoftIrq) {
				this.#cpuSoftIrq = softIrqUsage;
				this.notify("cpu_softirq");
			}

			if (niceUsage !== this.#cpuNice) {
				this.#cpuNice = niceUsage;
				this.notify("cpu_nice");
			}

			const total = 100 - idleUsage;
			if (total !== this.#cpuTotal) {
				this.#cpuTotal = total;
				this.notify("cpu_total");
			}
		});

		// Calculate memory usage
		interval(2000, () => {
			GTop.glibtop_get_mem(System.memory);

			if (System.memory.cached !== this.#memCached) {
				this.#memCached = System.memory.cached;
				this.notify("mem_cached");
			}

			if (System.memory.used !== this.#memUsed) {
				this.#memUsed = System.memory.used;
				this.notify("mem_used");
			}

			if (System.memory.free !== this.#memFree) {
				this.#memFree = System.memory.free;
				this.notify("mem_free");
			}

			const available = System.memory.free + System.memory.cached;
			if (available !== this.#memAvailable) {
				this.#memAvailable = available;
				this.notify("mem_available");
			}

			const usage = 100 - (available / System.memory.total) * 100;
			if (usage !== this.#memUsage) {
				this.#memUsage = usage;
				this.notify("mem_usage");
			}
		});

		// Calculate disk usage
		GTop.glibtop_get_disk(System.disk);
		const index = System.disk.xdisk_sectors_write.indexOf(
			Math.max(...System.disk.xdisk_sectors_write),
		);
		console.log("Disk index:", index);
		let prevRead = System.disk.xdisk_sectors_read[index];
		let prevWrite = System.disk.xdisk_sectors_write[index];

		interval(2000, () => {
			GTop.glibtop_get_disk(System.disk);
			const read = System.disk.xdisk_sectors_read[index];
			const write = System.disk.xdisk_sectors_write[index];

			const readDelta = read - prevRead;
			const writeDelta = write - prevWrite;
			prevRead = read;
			prevWrite = write;

			const readPS = readDelta / 2; // per second
			const writePS = writeDelta / 2; // per second
			const readKBPS = readPS / 2; // kibibytes per second (I don't know why this works)
			const writeKBPS = writePS / 2; // kibibytes per second (I don't know why this works)

			if (readKBPS !== this.#diskRead) {
				this.#diskRead = readKBPS * 1024; // convert to bytes per second
				this.notify("disk_read");
			}

			if (writeKBPS !== this.#diskWrite) {
				this.#diskWrite = writeKBPS * 1024; // convert to bytes per second
				this.notify("disk_write");
			}
		});
	}
}
