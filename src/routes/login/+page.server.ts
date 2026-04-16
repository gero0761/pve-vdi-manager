import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	// If already logged in, redirect
	if (locals.user) {
		const redirectTo = url.searchParams.get('redirectTo') || '/';
		throw redirect(303, redirectTo);
	}
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const username = data.get('username')?.toString();
		const password = data.get('password')?.toString();

		if (!username || !password) {
			return fail(400, { error: 'Benutzername und Passwort sind erforderlich', username });
		}

		const user = await db.getUserByUsername(username);
		if (!user) {
			return fail(401, { error: 'Ungültige Anmeldedaten', username });
		}

		try {
			const [saltHex, keyHex] = user.password_hash.split(':');
			const salt = Buffer.from(saltHex, 'hex');
			const key = Buffer.from(keyHex, 'hex');

			const hashToVerify = scryptSync(password, salt, 64);
			const isValid = timingSafeEqual(hashToVerify, key);

			if (!isValid) {
				return fail(401, { error: 'Ungültige Anmeldedaten', username });
			}
		} catch (err) {
			console.error('Error verifying password:', err);
			return fail(500, { error: 'Interner Server-Fehler' });
		}

		// Create Session
		const sessionId = crypto.randomUUID();
		const ONE_DAY = 1000 * 60 * 60 * 24;
		const expiresAt = new Date(Date.now() + ONE_DAY);

		await db.createSession({
			id: sessionId,
			user_id: user.id,
			created_at: new Date(),
			expires_at: expiresAt
		});

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			// secure: true in production, handled by sveltekit mostly based on environment
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 // 1 day in seconds
		});

		const redirectTo = url.searchParams.get('redirectTo') || '/';
		throw redirect(303, redirectTo);
	}
};
