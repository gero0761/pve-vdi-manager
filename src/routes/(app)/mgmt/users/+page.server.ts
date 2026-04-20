import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { randomBytes, scryptSync } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const users = await db.getAllUsers();
	return {
		users: users.map(u => ({
			id: u.id,
			username: u.username,
			first_name: u.first_name,
			last_name: u.last_name,
			role: u.role
		}))
	};
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const data = await request.formData();
		const id = data.get('id')?.toString();
		
		if (!id) return fail(400, { error: 'User ID is required' });
		
		// Prevent self-deletion
		if (id === locals.user?.id) {
			return fail(400, { error: 'You cannot delete yourself' });
		}
		
		await db.deleteUser(id);
		return { success: true };
	},
	changePassword: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id')?.toString();
		const password = data.get('password')?.toString();
		const passwordConfirm = data.get('passwordConfirm')?.toString();
		
		if (!id || !password || !passwordConfirm) {
			return fail(400, { error: 'All fields are required' });
		}
		
		if (password !== passwordConfirm) {
			return fail(400, { error: 'Passwords do not match' });
		}
		
		// Hash new password
		const salt = randomBytes(16);
		const key = scryptSync(password, salt, 64);
		const passwordHash = `${salt.toString('hex')}:${key.toString('hex')}`;
		
		await db.updateUser(id, { password_hash: passwordHash });
		return { success: true };
	},
	updateRole: async ({ request, locals }) => {
		const data = await request.formData();
		const id = data.get('id')?.toString();
		const role = data.get('role')?.toString() as 'admin' | 'user';
		
		if (!id || !role) return fail(400, { error: 'User ID and role are required' });
		
		// Prevent self-role-change
		if (id === locals.user?.id) {
			return fail(400, { error: 'You cannot change your own role' });
		}
		
		await db.updateUser(id, { role });
		return { success: true };
	}
};
