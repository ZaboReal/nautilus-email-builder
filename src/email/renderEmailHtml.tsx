/**
 * JSX entry point for the render path. Lives in a .tsx file so route
 * handlers (.ts) can import a plain function and avoid JSX in their own
 * source.
 */

import { EmailDocument } from "./EmailDocument";
import { renderEmail } from "./render";
import type { EmailData } from "./schema";

export function renderEmailHtml(data: EmailData): Promise<string> {
  return renderEmail(<EmailDocument data={data} />);
}
