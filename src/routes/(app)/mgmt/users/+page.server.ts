import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { randomBytes, scryptSync } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const users = await db.getAllUsers();
	const usersWithRoles = await Promise.all(users.map(async (u) => {
		const groupIds = await db.getUserGroupIds(u.id);
		return {
			id: u.id,
			username: u.username,
			first_name: u.first_name,
			last_name: u.last_name,
			role: groupIds.includes('system-admin') ? 'admin' : 'user'
		};
	}));

	return {
		users: usersWithRoles,
		isAdmin: locals.user?.role === 'admin',
		canCreateUsers: locals.user?.role === 'admin' || locals.user?.permissions?.userModification === true
	};
};

function hashPassword(password: string): string {
	const salt = randomBytes(16);
	const key = scryptSync(password, salt, 64);
	return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const data = await request.formData();
		const id = data.get('id')?.toString();

		if (!id) return fail(400, { error: 'User ID is required' });

		// Prevent self-deletion
		if (id === locals.user?.id) {
			return fail(400, { error: 'You cannot delete yourself' });
		}

		// Non-admins with user-modification can only delete regular users
		if (locals.user?.role !== 'admin') {
			const targetGroupIds = await db.getUserGroupIds(id);
			if (targetGroupIds.includes('system-admin')) {
				return fail(403, { error: 'You cannot delete an admin user' });
			}
		}

		await db.deleteUser(id);
		return { success: true };
	},

	changePassword: async ({ request, locals }) => {
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

		// Non-admins can only change passwords for regular users
		if (locals.user?.role !== 'admin') {
			const targetGroupIds = await db.getUserGroupIds(id);
			if (targetGroupIds.includes('system-admin')) {
				return fail(403, { error: 'You cannot change the password of an admin user' });
			}
		}

		await db.updateUser(id, { password_hash: hashPassword(password) });
		return { success: true };
	},

	updateRole: async ({ request, locals }) => {
		// Only admins can change roles
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Only admins can change user roles' });
		}

		const data = await request.formData();
		const id = data.get('id')?.toString();
		const role = data.get('role')?.toString() as 'admin' | 'user';

		if (!id || !role) return fail(400, { error: 'User ID and role are required' });

		// Prevent self-role-change
		if (id === locals.user?.id) {
			return fail(400, { error: 'You cannot change your own role' });
		}

		if (role === 'admin') {
			await db.addMemberToGroup('system-admin', id, 'user');
		} else {
			await db.removeMemberFromGroup('system-admin', id);
		}

		return { success: true };
	},

	createUser: async ({ request, locals }) => {
		// Must be admin or have user-modification permission
		const canCreate = locals.user?.role === 'admin' || locals.user?.permissions?.userModification;
		if (!canCreate) return fail(403, { error: 'Insufficient permissions' });

		const data = await request.formData();
		const username = data.get('username')?.toString();
		const password = data.get('password')?.toString();
		const firstName = data.get('firstName')?.toString();
		const lastName = data.get('lastName')?.toString();
		const role = data.get('role')?.toString() || 'user';

		if (!username || !password || !firstName || !lastName) {
			return fail(400, { error: 'All fields are required' });
		}

		const existingUser = await db.getUserByUsername(username);
		if (existingUser) {
			return fail(400, { error: `Username "${username}" already exists` });
		}

		const uuid = crypto.randomUUID();
		await db.createUser({
			id: uuid,
			username,
			password_hash: hashPassword(password),
			first_name: firstName,
			last_name: lastName
		});

		// Admins can elevate to admin role
		if (role === 'admin' && locals.user?.role === 'admin') {
			await db.addMemberToGroup('system-admin', uuid, 'user');
		}

		return { success: true, action: 'createUser' };
	},

	bulkCreate: async ({ request, locals }) => {
		// Must be admin or have user-modification permission
		const canCreate = locals.user?.role === 'admin' || locals.user?.permissions?.userModification;
		if (!canCreate) return fail(403, { error: 'Insufficient permissions' });

		const data = await request.formData();
		const usersJson = data.get('users')?.toString();

		if (!usersJson) return fail(400, { error: 'No user data provided' });

		let usersToCreate: { username: string; password: string; firstName: string; lastName: string; role: string }[];
		try {
			usersToCreate = JSON.parse(usersJson);
		} catch {
			return fail(400, { error: 'Invalid user data format' });
		}

		if (!Array.isArray(usersToCreate) || usersToCreate.length === 0) {
			return fail(400, { error: 'No users to create' });
		}

		const created: { username: string; firstName: string; lastName: string; password: string; role: string }[] = [];
		const errors: string[] = [];

		for (const u of usersToCreate) {
			if (!u.username || !u.password || !u.firstName || !u.lastName) {
				errors.push(`Incomplete data for user: ${u.username || '(no username)'}`);
				continue;
			}

			const existing = await db.getUserByUsername(u.username);
			if (existing) {
				errors.push(`Username "${u.username}" already exists`);
				continue;
			}

			const uuid = crypto.randomUUID();
			await db.createUser({
				id: uuid,
				username: u.username,
				password_hash: hashPassword(u.password),
				first_name: u.firstName,
				last_name: u.lastName
			});

			if (u.role === 'admin' && locals.user?.role === 'admin') {
				await db.addMemberToGroup('system-admin', uuid, 'user');
			}

			created.push({ username: u.username, firstName: u.firstName, lastName: u.lastName, password: u.password, role: u.role || 'user' });
		}

		if (created.length === 0) {
			return fail(400, { error: errors.join('; ') });
		}

		return { success: true, action: 'bulkCreate', created, errors };
	}
};
