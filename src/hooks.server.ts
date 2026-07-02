import { redirect, error, type Handle } from '@sveltejs/kit';
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
				const groupIds = await db.getUserGroupIds(user.id);
				const hasUserMod = await db.hasSystemPermission(user.id, 'user-modification');
				event.locals.user = {
					id: user.id,
					username: user.username,
					first_name: user.first_name,
					last_name: user.last_name,
					role: groupIds.includes('system-admin') ? 'admin' : 'user',
					permissions: {
						userModification: hasUserMod
					}
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

	// Route guards
	const isMgmtUsersRoute = event.url.pathname.startsWith('/mgmt/users');
	const isMgmtGroupsRoute = event.url.pathname.startsWith('/mgmt/groups');

	const isAdminRoute =
		isMgmtGroupsRoute ||
		event.url.pathname.startsWith('/api/pve/tasks') ||
		event.url.pathname.startsWith('/api/pve/clone') ||
		event.url.pathname.startsWith('/api/pve/templates');

	if (isAdminRoute && event.locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const isMgmtRoute = event.url.pathname.startsWith('/mgmt');
	if (isMgmtRoute) {
		const isAuthorized =
			event.locals.user?.role === 'admin' ||
			(isMgmtUsersRoute && event.locals.user?.permissions?.userModification);

		if (!isAuthorized) {
			throw redirect(303, '/');
		}
	}

	// Instance-level granular permission checks
	if (event.locals.user && event.locals.user.role !== 'admin') {
		const pathname = event.url.pathname;
		const method = event.request.method;

		// 1. API Actions (Power/Delete)
		const instanceMatch = pathname.match(/^\/api\/pve\/instances\/([a-z0-9-]+)$/);
		if (instanceMatch) {
			const instanceId = instanceMatch[1];
			if (method === 'DELETE') {
				const hasAccess = await db.hasInstanceAccess(event.locals.user.id, instanceId, 'delete');
				if (!hasAccess) throw error(403, 'Forbidden: Missing delete permission');
			} else if (method === 'POST') {
				const hasAccess = await db.hasInstanceAccess(event.locals.user.id, instanceId, 'power');
				if (!hasAccess) throw error(403, 'Forbidden: Missing power permission');
			}
		}

		// 2. Console Access (VNC API and Console Viewer)
		const vncMatch = pathname.match(/^\/api\/vnc\/([a-z0-9-]+)$/);
		const viewerMatch = pathname.match(/^\/console-viewer\/([a-z0-9-]+)$/);
		const consoleId = vncMatch ? vncMatch[1] : (viewerMatch ? viewerMatch[1] : null);

		if (consoleId) {
			const hasAccess = await db.hasInstanceAccess(event.locals.user.id, consoleId, 'console');
			if (!hasAccess) throw error(403, 'Forbidden: Missing console permission');
		}

		// 3. The rest is checked on the respective pages
	}

	const response = await resolve(event);

	return response;
};
