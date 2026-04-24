import { redirect, type Handle } from '@sveltejs/kit';
import { handleLoginRedirect } from '$lib/AuthenticationHandler';
import { db } from '$lib/server/db';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { runSyncJob } from '$lib/server/sync';

// Global background worker
let syncInterval: ReturnType<typeof setInterval>;

if (!(globalThis as any).__syncStarted) {
	(globalThis as any).__syncStarted = true;

	const intervalMinutes = env.DB_SYNC_INTERVAL ? parseInt(env.DB_SYNC_INTERVAL, 10) : 10;
	const intervalMs = 1000 * 60 * (intervalMinutes > 0 ? intervalMinutes : 10);

	console.log(`[Hooks] Initializing Proxmox DB Sync Job (Interval: ${intervalMinutes}m)`);

	// Initial run shortly after startup
	setTimeout(() => {
		runSyncJob();
	}, 5000);

	// Periodic run
	syncInterval = setInterval(() => {
		runSyncJob();
	}, intervalMs);
}

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

	// Admin-only routes
	const isAdminRoute =
		event.url.pathname.startsWith('/mgmt') ||
		event.url.pathname.startsWith('/api/pve/tasks') ||
		event.url.pathname.startsWith('/api/pve/clone') ||
		event.url.pathname.startsWith('/api/pve/templates');

	if (isAdminRoute && event.locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const response = await resolve(event);

	return response;
};
