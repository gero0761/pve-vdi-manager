import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function GET() {
	try {
		const instances = db.getAllInstances();
		return json({ instances });
	} catch (err) {
		console.error('Fetch instances error:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
