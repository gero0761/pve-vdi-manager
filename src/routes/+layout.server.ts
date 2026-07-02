import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		allowRegistration: env.DISABLE_PUBLIC_REGISTRATION !== 'true'
	};
};
