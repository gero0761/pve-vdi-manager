import { fail, redirect } from '@sveltejs/kit';
import { db } from '$db';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// If already logged in, redirect
	if (locals.user) throw redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username')?.toString();
		const password = data.get('password')?.toString();
		const passwordConfirm = data.get('passwordConfirm')?.toString();
		const firstName = data.get('firstName')?.toString();
		const lastName = data.get('lastName')?.toString();

		if (!username || !password || !passwordConfirm || !firstName || !lastName) {
			return fail(400, { error: 'All fields must be filled', username, firstName, lastName });
		}

		if (password !== passwordConfirm) {
			return fail(400, { error: 'Passwords do not match', username, firstName, lastName });
		}

		// Check if username already exists
		const existingUser = await db.getUserByUsername(username);
		if (existingUser) {
			return fail(400, { error: 'Username already exists', username, firstName, lastName });
		}

		// Hash password using native crypto module
		const salt = randomBytes(16);
		const key = scryptSync(password, salt, 64);
		const passwordHash = `${salt.toString('hex')}:${key.toString('hex')}`;

		// Provide a UUID without extra deps
		const uuid = crypto.randomUUID();

		const newUser = {
			id: uuid,
			username,
			password_hash: passwordHash,
			first_name: firstName,
			last_name: lastName
		};

		await db.createUser(newUser);

		// Optionally auto login or redirect to login. We'll simply redirect to login.
		throw redirect(303, '/login?registered=true');
	}
};
