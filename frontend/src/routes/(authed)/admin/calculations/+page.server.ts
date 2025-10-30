import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ parent }) => {
	await parent();
	return {};
};

export const actions = {
	recalculate: async ({ request, locals }) => {
		const api = locals.api;
		const formData = await request.formData();
		const fromMatchId = formData.get('fromMatchId');

		try {
			await api.admin.adminRecalculateMatches({
				fromMatchId: fromMatchId ? Number(fromMatchId) : undefined
			});
			return { success: true, message: 'MMR recalculation started successfully' };
		} catch (err: any) {
			return fail(500, {
				success: false,
				message: err.message || 'Failed to start recalculation'
			});
		}
	}
} satisfies Actions;
