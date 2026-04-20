import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function GET({ locals }) {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		let instances;
		if (user.role === 'admin') {
			instances = await db.getAllInstances();
		} else {
			instances = await db.getUserInstances(user.id);
		}
		
		return json({ instances });
	} catch (err) {
		console.error('Fetch instances error:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
