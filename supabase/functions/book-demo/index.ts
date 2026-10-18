// "Book a demo" form handler (CLAUDE.md 4.6, 7): honeypot + Cloudflare Turnstile → validate →
// rate limit → insert into `leads` → email notification via Resend (best effort).
// Deployed with verify_jwt = false: the marketing site calls it anonymously; Turnstile is the gate.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

// Cloudflare's documented always-pass test secret. Only used until TURNSTILE_SECRET_KEY is set;
// set it together with the real site key on the marketing site (PUBLIC_TURNSTILE_SITE_KEY).
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";
const MAX_PER_EMAIL_PER_DAY = 3;
const MAX_PER_DAY = 100;

const allowedOrigins = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  "https://menubuddy.be,https://www.menubuddy.be,http://localhost:4321"
).split(",");

const Lead = z.object({
  name: z.string().trim().min(1).max(100),
  restaurantName: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  email: z.email().max(200),
  phone: z.string().trim().max(40).optional(),
  language: z.enum(["nl", "fr", "en"]),
  preferredTime: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  /** Honeypot: hidden from people, bots fill it in. */
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(4096),
});

/** Our Cloudflare test deployments: menubuddy-site.<account>.workers.dev and its preview URLs. */
function isTestDeployment(hostname: string): boolean {
  return hostname.endsWith(".workers.dev") && /(^|-)menubuddy-/.test(hostname);
}

function corsHeaders(origin: string | null): Record<string, string> {
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
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function verifyTurnstile(
  token: string,
  ip: string | null,
): Promise<boolean> {
  const form = new FormData();
  form.append(
    "secret",
    Deno.env.get("TURNSTILE_SECRET_KEY") ?? TURNSTILE_TEST_SECRET,
  );
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: form,
    },
  );
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

async function notify(lead: z.infer<typeof Lead>) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("NOTIFY_EMAIL");
  if (!apiKey || !to) {
    console.warn(
      "RESEND_API_KEY or NOTIFY_EMAIL not set; lead saved without email notification",
    );
    return;
  }
  const lines = [
    `Naam: ${lead.name}`,
    `Restaurant: ${lead.restaurantName ?? "-"}`,
    `Stad: ${lead.city ?? "-"}`,
    `E-mail: ${lead.email}`,
    `Telefoon: ${lead.phone ?? "-"}`,
    `Taal: ${lead.language}`,
    `Voorkeur moment: ${lead.preferredTime ?? "-"}`,
    "",
    lead.message ?? "",
  ];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") ?? "MenuBuddy <onboarding@resend.dev>",
      to,
      reply_to: lead.email,
      subject: `Demo-aanvraag: ${lead.restaurantName || lead.name}${lead.city ? ` (${lead.city})` : ""}`,
      text: lines.join("\n"),
    }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST")
    return json({ ok: false, error: "method" }, 405, cors);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400, cors);
  }
  const parsed = Lead.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400, cors);
  const lead = parsed.data;
  const email = lead.email.toLowerCase();

  // Bot filled the honeypot: pretend it worked, store nothing.
  if (lead.website) return json({ ok: true }, 200, cors);

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    null;
  if (!(await verifyTurnstile(lead.turnstileToken, ip))) {
    return json({ ok: false, error: "captcha" }, 403, cors);
  }

  const secretKey =
    JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
    auth: { persistSession: false },
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [perEmail, total] = await Promise.all([
    db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since),
    db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);
  if (
    (perEmail.count ?? 0) >= MAX_PER_EMAIL_PER_DAY ||
    (total.count ?? 0) >= MAX_PER_DAY
  ) {
    return json({ ok: false, error: "rate_limited" }, 429, cors);
  }

  const { error } = await db.from("leads").insert({
    name: lead.name,
    restaurant_name: lead.restaurantName || null,
    city: lead.city || null,
    email,
    phone: lead.phone || null,
    language: lead.language,
    preferred_time: lead.preferredTime || null,
    message: lead.message || null,
    source: "book_demo",
  });
  if (error) {
    console.error("Insert failed", error.message);
    return json({ ok: false, error: "server" }, 500, cors);
  }

  try {
    await notify(lead);
  } catch (e) {
    console.error("Notification failed", e);
  }
  return json({ ok: true }, 200, cors);
});
