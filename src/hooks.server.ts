import { redirect, type Handle } from '@sveltejs/kit';
import { handleLoginRedirect } from '$lib/AuthenticationHandler';
import { db } from '$lib/server/db';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
	if (dev) console.log('Handling: ', event.url.pathname);

	const isPublicRoute =
		event.url.pathname === '/' ||
		event.url.pathname.startsWith('/login') ||
		event.url.pathname.startsWith('/register') ||
		event.url.pathname.startsWith('/logout');

	const sessionId = event.cookies.get('session');

	if (sessionId) {
		const session = await db.getSessionById(sessionId);

		if (session && new Date() < session.expires_at) {
			const user = await db.getUserById(session.user_id);
			if (user) {
				event.locals.user = {
					id: user.id,
					username: user.username,
					first_name: user.first_name,
					last_name: user.last_name,
					role: user.role
				};
			}
		} else if (session) {
			await db.deleteSession(session.id);
			event.cookies.delete('session', { path: '/' });
		}
	}

	if (!isPublicRoute && !event.locals.user) {
		throw redirect(303, handleLoginRedirect(event));
	}

	const response = await resolve(event);

	return response;
};