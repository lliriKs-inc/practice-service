import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().trim().min(1, "Full name is required"),
});

export type RegisterDto = z.infer<typeof registerSchema>;
