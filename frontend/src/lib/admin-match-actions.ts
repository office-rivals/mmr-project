import { createServerFn } from '@tanstack/react-start';
import { deleteMatch, type DeleteMatchInput } from '@/lib/server/delete-match';

export type {
  AdminMatchActionResult,
  DeleteMatchInput,
} from '@/lib/server/delete-match';

export const deleteMatchFn = createServerFn({ method: 'POST' })
  .validator((input: DeleteMatchInput) => input)
  .handler(({ data }) => deleteMatch(data));
