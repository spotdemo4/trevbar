import GObject, { getter, register } from 'ags/gobject';
import { interval } from 'ags/time';
import GTop from 'gi://GTop?version=2.0';

@register({ GTypeName: 'SystemInfo' })
export default class SystemInfo extends GObject.Object {
	static instance: SystemInfo;
	static cpu: GTop.glibtop_cpu;
	static memory: GTop.glibtop_mem;

	static get_default() {
		if (!this.instance) this.instance = new SystemInfo();

		return this.instance;
	}

	#cpuUsage = 0;
	#memUsage = 0;

	@getter(Number)
	get cpu_usage() {
		return this.#cpuUsage;
	}

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
			const system = 100 - userUsage - idleUsage;
			const total = user + system;

			prevUser = SystemInfo.cpu.user;
			prevIdle = SystemInfo.cpu.idle;
			prevTotal = SystemInfo.cpu.total;

			this.#cpuUsage = total;
			this.notify('cpu_usage');
		});

		// Calculate memory usage
		interval(2000, () => {
			GTop.glibtop_get_mem(SystemInfo.memory);

			// This is the wrong way of doing this https://unix.stackexchange.com/questions/499649/is-cached-memory-de-facto-free
			const availableUsed = SystemInfo.memory.used - SystemInfo.memory.cached;

			this.#memUsage = Math.round((availableUsed / SystemInfo.memory.total) * 100);
			this.notify('mem_usage');
		});
	}
}
