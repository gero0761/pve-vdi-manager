import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('session');
	if (sessionId) {
		await db.deleteSession(sessionId);
		cookies.delete('session', { path: '/' });
	}

	throw redirect(303, '/login');
};
