/**
 * Thin wrapper around @react-email/render. Centralized so the call site
 * can be swapped for an edge runtime later (the `render` package ships
 * separate browser/edge/node builds via export conditions).
 */

import { render } from "@react-email/render";
import type { ReactElement } from "react";

export async function renderEmail(node: ReactElement): Promise<string> {
  return render(node, { pretty: false });
}

export async function renderEmailPretty(node: ReactElement): Promise<string> {
  return render(node, { pretty: true });
}
