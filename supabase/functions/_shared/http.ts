// Shared plumbing for the owner-facing edge functions (called from the app with the owner's login).
import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2";

const allowedOrigins = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  "https://app.menubuddy.be,http://localhost:5173"
).split(",");

/** Our Cloudflare test deployments: menubuddy-app.<account>.workers.dev and its preview URLs. */
function isTestDeployment(hostname: string): boolean {
  return hostname.endsWith(".workers.dev") && /(^|-)menubuddy-/.test(hostname);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  let allowed = false;
  try {
    allowed =
      origin !== null &&
      (allowedOrigins.includes(origin) ||
        isTestDeployment(new URL(origin).hostname));
  } catch {
    allowed = false;
  }
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin! } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, x-client-info",
    Vary: "Origin",
  };
}

export function json(
  body: unknown,
  status: number,
  cors: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Service-role client: bypasses RLS, so check membership yourself first. */
export function adminClient(): SupabaseClient {
  const secretKey =
    JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
    auth: { persistSession: false },
  });
}

function publishableKey(): string {
  return (
    JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ??
    Deno.env.get("SUPABASE_ANON_KEY")
  );
}

/** The logged-in user behind the request's Authorization header, or null. */
export async function requestUser(req: Request): Promise<User | null> {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;
  const userDb = createClient(Deno.env.get("SUPABASE_URL")!, publishableKey(), {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
  } = await userDb.auth.getUser(authorization.replace(/^Bearer /i, ""));
  return user;
}

/** Is this user an owner of this restaurant? */
export async function isOwner(
  db: SupabaseClient,
  restaurantId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await db
    .from("restaurant_members")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  return !!data;
}
