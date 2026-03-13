import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { apiClient } }) => {
	const seasonId = url.searchParams.get('seasonId');
	const limit = url.searchParams.get('limit');
	const offset = url.searchParams.get('offset');
	const userId = url.searchParams.get('userId');

	const matches = await apiClient.mmrApi.mMRV2GetMatches({
		seasonId: seasonId ? Number(seasonId) : undefined,
		limit: limit ? Number(limit) : undefined,
		offset: offset ? Number(offset) : undefined,
		userId: userId ? Number(userId) : undefined,
	});

	return new Response(JSON.stringify(matches));
};
