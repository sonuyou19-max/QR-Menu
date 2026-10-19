// Website import: Buddy picks which links on the restaurant's page are its current menu
// (website.ts). Link texts alone can't tell a menu photo from a burger photo, or this year's
// menu from last year's.
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@0.135.0/helpers/beta/zod";
import { z } from "npm:zod@4";
import { claudeClient, fallbackOptions, menuModel } from "../_shared/claude.ts";
import { languageName, menuLinksPrompt } from "../_shared/prompts.ts";
import type { Pick } from "./website.ts";

const Picked = z.object({
  chosen: z
    .array(z.number().int())
    .describe("Numbers of the links that are the current menu; [] if none"),
});

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export function menuLinkPicker(
  sourceLanguage: string,
  onUsage: (usage: Usage) => PromiseLike<unknown>,
): Pick {
  return async (candidates, context) => {
    const client = claudeClient({ timeoutMs: 30_000 });
    const response = await client.beta.messages.parse({
      model: menuModel,
      max_tokens: 1000,
      ...fallbackOptions,
      output_config: { effort: "low", format: betaZodOutputFormat(Picked) },
      system: menuLinksPrompt(languageName(sourceLanguage)),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            today: new Date().toISOString().slice(0, 10),
            page: context,
            links: candidates.map((c, i) => ({
              number: i,
              kind: c.kind,
              text: c.text,
              address: c.url.href,
            })),
          }),
        },
      ],
    });
    await onUsage({
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    });
    if (!response.parsed_output)
      throw new Error(`no pick: ${response.stop_reason}`);
    return response.parsed_output.chosen;
  };
}
