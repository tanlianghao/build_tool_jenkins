import { z } from "zod";

export const BranchResultSchema = z.object({
  name: z.string().optional(),
  merged: z.boolean().optional(),
  protected: z.boolean().optional(),
  default: z.boolean().optional(),
  developers_can_push: z.boolean().optional(),
  developers_can_merge: z.boolean().optional(),
  can_push: z.boolean().optional(),
  web_url: z.url().optional(),
  commit: z.object({
    id: z.string().optional(),
    short_id: z.string().optional(),
    created_at: z.string().optional(),
    parent_ids: z.array(z.string()).optional(),
    title: z.string().optional(),
    message: z.string().optional(),
    author_name: z.string().optional(),
    author_email: z.email().optional(),
    authored_date: z.string().optional(),
    committer_name: z.string().optional(),
    committer_email: z.email().optional(),
    committed_date: z.string().optional(),
    trailers: z.any().optional(),
    extended_trailers: z.any().optional(),
    web_url: z.url().optional(),
  })
});

// TypeScript 类型（从 schema 推断）
export type BranchResult = z.infer<typeof BranchResultSchema>;