// Claude API client for edge functions. The key and model names come from Supabase secrets
// (CLAUDE.md 2, 11); the key never reaches the browser.
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

export { Anthropic };

/** Menu extraction + translation (vision). Override with the MENU_MODEL secret. */
export const menuModel = Deno.env.get("MENU_MODEL") || "claude-sonnet-5-5";

/**
 * On a policy decline, let the API retry on the model's default fallback inside the same call.
 * Models without fallback support simply run alone.
 */
export const fallbackOptions: {
  betas: Anthropic.AnthropicBeta[];
  fallbacks: "default";
} = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

export function claudeClient(options: { timeoutMs: number }): Anthropic {
  return new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    timeout: options.timeoutMs,
    maxRetries: 1,
  });
}
