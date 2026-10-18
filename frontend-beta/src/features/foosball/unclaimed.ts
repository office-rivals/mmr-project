import { createServerFn } from '@tanstack/react-start';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import type { TableMatchResponse, TableResponse } from './api';

export interface TableWithUnclaimed {
  table: TableResponse;
  unclaimed: TableMatchResponse[];
}

/** The league's tables with the matches still waiting for players. */
export const listTablesWithUnclaimedFn = createServerFn({ method: 'GET' })
  .validator((input: { orgId: string; leagueId: string }) => input)
  .handler(
    async ({ data: { orgId, leagueId } }): Promise<TableWithUnclaimed[]> => {
      const { foosballApi } = await requireApiClientV3();
      const [tables, claimable] = await Promise.all([
        foosballApi.listTables(orgId),
        foosballApi.listClaimable(orgId),
      ]);
      return tables
        .filter((table) => table.leagueId === leagueId)
        .map((table) => ({
          table,
          unclaimed: claimable.filter((m) => m.tableId === table.id),
        }));
    }
  );
