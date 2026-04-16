import { redirect, type Handle } from '@sveltejs/kit';
import { handleLoginRedirect } from '$lib/AuthenticationHandler';
import { db } from '$lib/server/db';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
	if (dev) console.log('Handling: ', event.url.pathname);

	if (
		!event.url.pathname.startsWith('/login') &&
		!event.url.pathname.startsWith('/register') &&
		!event.url.pathname.startsWith('/logout')
	) {
		const sessionId = event.cookies.get('session');

		if (!sessionId) {
			throw redirect(303, handleLoginRedirect(event));
		}
		
		const session = await db.getSessionById(sessionId);

		if (!session) {
			event.cookies.delete('session', { path: '/' });
			throw redirect(303, handleLoginRedirect(event));
		}

		if (new Date() >= session.expires_at) {
			await db.deleteSession(session.id);
			event.cookies.delete('session', { path: '/' });
			throw redirect(303, handleLoginRedirect(event));
		}
		
		const user = await db.getUserById(session.user_id);
		if (!user) {
			event.cookies.delete('session', { path: '/' });
			throw redirect(303, handleLoginRedirect(event));
		}

		event.locals.user = {
			id: user.id,
			username: user.username,
			first_name: user.first_name,
			last_name: user.last_name,
			role: user.role
		};
	}

	const response = await resolve(event);

	return response;
};