import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// The user is guaranteed to be logged in due to hooks and layout
	return {
		user: locals.user
	};
};

function hashPassword(password: string): string {
	const salt = randomBytes(16);
	const key = scryptSync(password, salt, 64);
	return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export const actions: Actions = {
	changePassword: async ({ request, locals }) => {
		const userId = locals.user?.id;
		if (!userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const data = await request.formData();
		const currentPassword = data.get('currentPassword')?.toString();
		const newPassword = data.get('newPassword')?.toString();
		const confirmPassword = data.get('confirmPassword')?.toString();

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { error: 'All fields are required' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { error: 'New passwords do not match' });
		}

		const dbUser = await db.getUserByUsername(locals.user.username);
		if (!dbUser) {
			return fail(404, { error: 'User not found' });
		}

		// Verify current password
		try {
			const [saltHex, keyHex] = dbUser.password_hash.split(':');
			const salt = Buffer.from(saltHex, 'hex');
			const key = Buffer.from(keyHex, 'hex');

			const hashToVerify = scryptSync(currentPassword, salt, 64);
			const isValid = timingSafeEqual(hashToVerify, key);

			if (!isValid) {
				return fail(400, { error: 'Incorrect current password' });
			}
		} catch (err) {
			console.error('Error verifying password:', err);
			return fail(500, { error: 'Internal server error' });
		}

		// Update to new password
		await db.updateUser(userId, { password_hash: hashPassword(newPassword) });

		return { success: true };
	}
};
