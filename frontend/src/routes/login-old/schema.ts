import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginSchema = typeof loginSchema;

export type LoginForm = z.infer<typeof loginSchema>;
