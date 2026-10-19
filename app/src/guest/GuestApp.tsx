import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { GuestMenu } from "./GuestMenu";

/** Public guest menu at /m/<slug>: no login, no dashboard code. */
export function renderGuest(root: Root, slug: string) {
  root.render(
    <StrictMode>
      <GuestMenu slug={slug} />
    </StrictMode>,
  );
}
