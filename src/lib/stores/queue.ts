import { writable } from 'svelte/store';

export type QueueAction = 'clone' | 'start' | 'stop' | 'delete' | 'unknown';

export interface PveTask {
	id: string; // UPID
	vmid: string;
	action: QueueAction;
	startTime: string;
	node: string;
}

function createPveTaskStore() {
	const { subscribe, set } = writable<PveTask[]>([]);
	let interval: ReturnType<typeof setInterval>;

	return {
		subscribe,
		startPolling: () => {
			// Immediate fetch
			fetch('/api/pve/tasks')
				.then((res) => res.json())
				.then((data) => {
					if (data.tasks) set(data.tasks);
				})
				.catch((err) => console.error('Initial PVE task fetch failed', err));

			interval = setInterval(async () => {
				try {
					const res = await fetch('/api/pve/tasks');
					if (res.ok) {
						const data = await res.json();
						if (data.tasks) {
							set(data.tasks);
						}
					}
				} catch {
					// Ignore network errors on polling
				}
			}, 3000); // Poll every 3 seconds to stay reactive
		},
		stopPolling: () => {
			if (interval) clearInterval(interval);
		}
	};
}

export const taskQueue = createPveTaskStore();
