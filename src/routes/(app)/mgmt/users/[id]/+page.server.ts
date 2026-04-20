import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const user = await db.getUserById(params.id);
	if (!user) throw error(404, 'User not found');

	const assignedInstances = await db.getUserInstances(user.id);
	const allInstances = await db.getAllInstances();
	
	// Find instances NOT assigned to the user
	const availableInstances = allInstances.filter(
		inst => !assignedInstances.some(ai => ai.id === inst.id)
	);

	return {
		targetUser: {
			id: user.id,
			username: user.username,
			first_name: user.first_name,
			last_name: user.last_name,
			role: user.role
		},
		assignedInstances,
		availableInstances
	};
};

export const actions: Actions = {
	assign: async ({ request, params }) => {
		const data = await request.formData();
		const instanceId = data.get('instanceId')?.toString();
		
		if (!instanceId) return fail(400, { error: 'Instance ID is required' });
		
		await db.assignInstanceToUser(params.id, instanceId);
		return { success: true };
	},
	remove: async ({ request, params }) => {
		const data = await request.formData();
		const instanceId = data.get('instanceId')?.toString();
		
		if (!instanceId) return fail(400, { error: 'Instance ID is required' });
		
		await db.removeInstanceFromUser(params.id, instanceId);
		return { success: true };
	}
};
