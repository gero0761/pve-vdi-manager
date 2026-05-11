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
			instances = (await db.getAllInstances()).map(i => ({
                ...i,
                permissions: {
                    power: true,
                    delete: true,
                    console: true
                }
            }));
		} else {
			const rawInstances = await db.getUserInstances(user.id);
            instances = await Promise.all(rawInstances.map(async i => ({
                ...i,
                permissions: {
                    power: await db.hasInstanceAccess(user.id, i.id, 'power'),
                    delete: await db.hasInstanceAccess(user.id, i.id, 'delete'),
                    console: await db.hasInstanceAccess(user.id, i.id, 'console')
                }
            })));
		}
		
		return json({ instances });
	} catch (err) {
		console.error('Fetch instances error:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
