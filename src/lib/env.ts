import "server-only";
import { z } from "zod";

/**
 * Server-side configuration, validated once. Secrets live only in environment
 * variables (Vercel project settings in production, .env.local locally) and
 * never reach the browser: only NEXT_PUBLIC_* values are bundled client-side.
 */
const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Server is missing or has invalid configuration: ${missing}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
