// Runs evals.json against the deployed menu-chat function and prints what failed.
// deno run --allow-net --allow-read supabase/functions/menu-chat/run-evals.ts
// Run it before changing the chat prompt, guard layer or CHAT_MODEL (CLAUDE.md 4.1). Each run
// costs a few cents and adds the questions to the demo restaurant's chat log.

const SUPABASE_URL = "https://eoeqtwskfqawxfpuyhac.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_vkrdzgiRxWrNC1Tl-xYMGA_uFxgulgI";

interface Expect {
  answer_types?: string[];
  notice?: string | null;
  must_reference?: string[];
  must_reference_any?: string[];
  must_not_reference?: string[];
  max_references?: number;
  allowed_amounts?: number[];
  must_not_say?: string[];
  must_say_any?: string[];
  language_hint?: string[];
}
interface Case {
  id: string;
  language: string;
  question: string;
  expect: Expect;
}
export interface Reply {
  answer: string | null;
  dishIds: string[];
  answerType: string;
  notice: string | null;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const AMOUNT =
  /(?:€|\beur\b|\beuros?\b)\s*(\d{1,4}(?:[.,]\d{1,2})?)|(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|\beur\b|\beuros?\b)/gi;

/** The problems with one reply (empty = pass). `names` maps dish id → name as on the menu. */
export function check(c: Case, r: Reply, names: Map<string, string>): string[] {
  const e = c.expect;
  const problems: string[] = [];
  const text = (r.answer ?? "").toLowerCase();
  const refs = r.dishIds.map((id) => key(names.get(id) ?? id));
  const has = (k: string) => refs.some((n) => n.startsWith(key(k)));
  if (e.answer_types && !e.answer_types.includes(r.answerType))
    problems.push(`answer_type ${r.answerType}`);
  if ("notice" in e && e.notice !== r.notice) problems.push(`notice ${r.notice}`);
  for (const k of e.must_reference ?? []) if (!has(k)) problems.push(`missing dish ${k}`);
  if (e.must_reference_any && !e.must_reference_any.some(has))
    problems.push(`none of ${e.must_reference_any.join(", ")}`);
  for (const k of e.must_not_reference ?? []) if (has(k)) problems.push(`mentions ${k}`);
  if (e.max_references !== undefined && refs.length > e.max_references)
    problems.push(`${refs.length} dishes referenced`);
  if (e.allowed_amounts)
    for (const m of (r.answer ?? "").matchAll(AMOUNT)) {
      const amount = Number((m[1] ?? m[2])!.replace(",", "."));
      if (!e.allowed_amounts.some((a) => Math.abs(a - amount) < 0.005))
        problems.push(`amount ${amount}`);
    }
  for (const s of e.must_not_say ?? [])
    if (text.includes(s.toLowerCase())) problems.push(`says "${s}"`);
  if (e.must_say_any && !e.must_say_any.some((s) => text.includes(s.toLowerCase())))
    problems.push(`says none of ${e.must_say_any.join(" / ")}`);
  if (e.language_hint && !e.language_hint.some((s) => text.includes(s.toLowerCase())))
    problems.push("language?");
  return problems;
}

if (import.meta.main) {
  const evals = JSON.parse(
    await Deno.readTextFile(new URL("./evals.json", import.meta.url)),
  ) as { restaurant: string; cases: Case[] };
  const headers = {
    "Content-Type": "application/json",
    apikey: PUBLISHABLE_KEY,
    Authorization: `Bearer ${PUBLISHABLE_KEY}`,
  };
  const menu = await (
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_menu`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_slug: evals.restaurant, p_language: null }),
    })
  ).json();
  const names = new Map<string, string>();
  for (const c of menu.categories) for (const d of c.items) names.set(d.id, d.name);

  let failed = 0;
  for (const c of evals.cases) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/menu-chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        slug: evals.restaurant,
        language: c.language,
        sessionId: `eval-${c.id}-${Date.now()}`.slice(0, 64),
        messages: [{ role: "guest", text: c.question }],
      }),
    });
    const reply = (await res.json()) as Reply;
    const problems = res.ok ? check(c, reply, names) : [`HTTP ${res.status}`];
    if (problems.length) failed++;
    console.log(
      `${problems.length ? "FAIL" : "ok  "} ${c.id}: ${reply.answer ?? "(fallback)"}${
        problems.length ? `\n     → ${problems.join("; ")}` : ""
      }`,
    );
  }
  console.log(`\n${evals.cases.length - failed}/${evals.cases.length} passed`);
  if (failed) Deno.exit(1);
}
