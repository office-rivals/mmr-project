import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import type { ReactNode } from 'react';
import { AppLink } from '@/components/app-link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { OpponentEntry } from '@/lib/server/profile';

interface HeadToHeadTableProps {
  title: string;
  icon: ReactNode;
  rows: OpponentEntry[];
  playerHref: (leaguePlayerId: string) => string;
}

/**
 * The "Most common opponents" / "Most common teammates" card.
 *
 * The name cell wrapper is `flex flex-col items-start` and must **not** gain
 * `flex-1`: profile e2e locates the match card's left column by the exact
 * class chain `.flex.flex-1.flex-col.items-start`, and this table would
 * otherwise be picked up as a match card.
 */
export function HeadToHeadTable({
  title,
  icon,
  rows,
  playerHref,
}: HeadToHeadTableProps) {
  const { formatNumber } = useLocaleFormatters();
  return (
    <Card>
      <CardContent className="flex flex-col p-0 md:p-6">
        <h2 className="flex items-center space-x-2 px-4 py-3 text-xl md:p-0 md:text-2xl">
          {icon}
          <span>{title}</span>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              {/* Both labels are always in the DOM; only visibility is responsive. */}
              <TableHead>
                <span className="sm:hidden">W</span>
                <span className="hidden sm:inline">Wins</span>
              </TableHead>
              <TableHead>
                <span className="sm:hidden">L</span>
                <span className="hidden sm:inline">Losses</span>
              </TableHead>
              <TableHead className="text-right">Win %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.leaguePlayerId}>
                <TableCell>
                  <AppLink
                    className="hover:underline"
                    to={playerHref(row.leaguePlayerId)}
                  >
                    <div className="flex flex-col items-start">
                      {row.displayName ? (
                        <span className="hidden w-full truncate sm:block">
                          {row.displayName}
                        </span>
                      ) : null}
                      <span className="block">
                        {row.username ?? row.displayName ?? 'Unknown'}
                      </span>
                    </div>
                  </AppLink>
                </TableCell>
                <TableCell>{row.wins}</TableCell>
                <TableCell>{row.losses}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(row.total > 0 ? row.wins / row.total : 0, {
                    style: 'percent',
                    maximumFractionDigits: 0,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
