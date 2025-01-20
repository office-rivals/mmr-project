import { z } from 'zod';

export const activeMatchSubmitSchema = z.object({
  // TODO: Get all values from server or configuration file
  team1Score: z.number().int().min(0).max(10),
  team2Score: z.number().int().min(0).max(10),
});

export type ActiveMatchSubmitSchema = typeof activeMatchSubmitSchema;

export type ActiveMatchSubmitForm = z.infer<typeof activeMatchSubmitSchema>;
