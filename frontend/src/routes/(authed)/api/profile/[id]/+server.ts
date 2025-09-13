import type { RequestHandler } from './$types';
import type { MemberLeaderboardEntry } from './types';

export const GET: RequestHandler = async ({ 
    params,
    locals: { apiClient } },
    url,
) => {
    const playerId = Number(params.id);
    //const searchParams = url.searchParams;
    const seasonId = undefined;/* searchParams.get('season')
    ? Number(searchParams.get('season'))
    : undefined;*/
    const [userProfile, rawMatches, users, mmrHistory, seasons] =
        await Promise.all([
            apiClient.profileApi.profileGetProfile(),
            apiClient.mmrApi.mMRV2GetMatches({
                userId: playerId,
                limit: 1000,
                offset: 0,
                seasonId,
            }),
            apiClient.usersApi.usersGetUsers(),
            apiClient.statisticsApi.statisticsGetPlayerHistory({
                userId: playerId,
                seasonId,
            }),
            apiClient.seasonsApi.seasonsGetSeasons(),
        ]);

    const { userId: currentUserPlayerId } = userProfile;

    const user = users.find((user) => user.userId === playerId);
    if (!user) {
        throw new Error('Player not found');
    }

    const mmr = mmrHistory[mmrHistory.length - 1]?.mmr;
    const matches = rawMatches.map((match) =>
        movePlayerToMember1(match, playerId)
    );
    const totalMatches = matches.length;
    const wins = matches.filter((match) => {
        const winnerTeam =
            match.team1.score > match.team2.score ? match.team1 : match.team2;
        return isOnTeam(winnerTeam, playerId);
    }).length;
    const lost = totalMatches - wins;
    const winrate = totalMatches > 0 ? wins / totalMatches : 0;

    const msSinceLastMatch = matches[0]
        ? new Date(matches[0].date).getTime() - new Date().getTime()
        : null;
    const daysSinceLastMatch = msSinceLastMatch
        ? millisecondsToDays(msSinceLastMatch)
        : null;


    const teammates = Object.entries(
        matches
            .map((match) => {
                if (
                    match.team1.member1 === playerId ||
                        match.team1.member2 === playerId
                ) {
                    return match.team1;
                }

                return match.team2;
            })
            .reduce<Record<number, MemberLeaderboardEntry>>((acc, team) => {
                const isWin = team.score === 10;
                acc[team.member1] = {
                    ...acc[team.member1],
                    playerId: team.member1,
                    wins: (acc[team.member1]?.wins ?? 0) + (isWin ? 1 : 0),
                    losses: (acc[team.member1]?.losses ?? 0) + (isWin ? 0 : 1),
                    total: (acc[team.member1]?.total ?? 0) + 1,
                };
                acc[team.member2] = {
                    ...acc[team.member2],
                    playerId: team.member2,
                    wins: (acc[team.member2]?.wins ?? 0) + (isWin ? 1 : 0),
                    losses: (acc[team.member2]?.losses ?? 0) + (isWin ? 0 : 1),
                    total: (acc[team.member2]?.total ?? 0) + 1,
                };
                return acc;
            }, {})
    )
    .filter(([, stats]) => stats.playerId !== playerId)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([, stats]) => stats)
    .slice(0, 5);

    const opponents = Object.entries(
        matches
            .map((match) => {
                if (
                    match.team1.member1 === playerId ||
                        match.team1.member2 === playerId
                ) {
                    return match.team2;
                }

                return match.team1;
            })
            .reduce<Record<number, MemberLeaderboardEntry>>((acc, team) => {
                const isWin = team.score === 10;
                acc[team.member1] = {
                    ...acc[team.member1],
                    playerId: team.member1,
                    wins: (acc[team.member1]?.wins ?? 0) + (isWin ? 0 : 1),
                    losses: (acc[team.member1]?.losses ?? 0) + (isWin ? 1 : 0),
                    total: (acc[team.member1]?.total ?? 0) + 1,
                };
                acc[team.member2] = {
                    ...acc[team.member2],
                    playerId: team.member2,
                    wins: (acc[team.member2]?.wins ?? 0) + (isWin ? 0 : 1),
                    losses: (acc[team.member2]?.losses ?? 0) + (isWin ? 1 : 0),
                    total: (acc[team.member2]?.total ?? 0) + 1,
                };
                return acc;
            }, {})
    )
    .sort((a, b) => b[1].total - a[1].total)
    .map(([, stats]) => stats)
    .slice(0, 5);

    return new Response(
        JSON.stringify({
            user, 
            stats: {
                mmr,
                totalMatches,
                wins,
                lost,
                winrate,
                msSinceLastMatch,
                daysSinceLastMatch,
            },
            mmrHistory,
            //seasons,
            matchHistory: {
                matches,
                teammates,
                opponents,
            },
        })
    );
};

