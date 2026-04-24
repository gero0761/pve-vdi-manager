import { json } from '@sveltejs/kit';
import { pveFetch } from '$lib/server/pve';
import { env } from '$env/dynamic/private';

export async function GET() {
	try {
		const res = await pveFetch('/cluster/tasks');
		const pveRes = await res.json();

		if (!pveRes.data) {
			return json({ tasks: [] });
		}

		// Proxmox task user is either "user@pam" or "user@pam!tokenID"
		const serviceUser = env.PVE_TOKEN_ID.substring(0, env.PVE_TOKEN_ID.indexOf('!'));

		const relevantTypes = [
			'qmclone',
			'qmstart',
			'qmstop',
			'qmdestroy',
			'vzclone',
			'vzstart',
			'vzstop',
			'vzdestroy'
		];

		interface PveTaskRecord {
			status?: string;
			user?: string;
			type: string;
			upid: string;
			id: string;
			starttime: number;
			node: string;
		}

		const activeTasks = pveRes.data.filter((task: PveTaskRecord) => {
			// Only running tasks
			if (task.status && task.status !== 'running') return false;

			// Filter for only the configured service user
			if (!task.user || !task.user.includes(serviceUser)) return false;

			// Filter only typical VM/LXC actions
			if (!relevantTypes.includes(task.type)) return false;

			return true;
		});

		const tasks = activeTasks.map((t: PveTaskRecord) => {
			let action = 'unknown';
			if (t.type.includes('clone')) action = 'clone';
			else if (t.type.includes('start')) action = 'start';
			else if (t.type.includes('stop')) action = 'stop';
			else if (t.type.includes('destroy')) action = 'delete';

			return {
				id: t.upid,
				vmid: t.id,
				action,
				startTime: new Date(t.starttime * 1000).toISOString(),
				node: t.node
			};
		});

		return json({ tasks });
	} catch (err) {
		console.error('Failed to fetch PVE tasks:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
