import { z } from "zod";

export const categorySchema = z.object({
  slug: z.string(),
  name: z.string(),
  is_virtual: z.boolean(),
});

export const profileSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatar_url: z.string().nullable().optional(),
  role: z.enum(["player", "admin"]).default("player"),
  created_at: z.string().optional(),
});

export const ratingSchema = z.object({
  user_id: z.string(),
  category: z.string(),
  preset: z.enum(["blitz", "standard", "rapid"]),
  rating: z.number(),
  rd: z.number(),
  vol: z.number(),
  games_played: z.number(),
  updated_at: z.string().optional(),
});

export const answerRequestSchema = z.object({
  position: z.number().int().nonnegative(),
  answer: z.string().max(50),
});

export const matchmakingJoinSchema = z.object({
  category: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/),
  preset: z.enum(["blitz", "standard", "rapid"]),
});

export type Category = z.infer<typeof categorySchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Rating = z.infer<typeof ratingSchema>;
export type AnswerRequest = z.infer<typeof answerRequestSchema>;
export type MatchmakingJoin = z.infer<typeof matchmakingJoinSchema>;
