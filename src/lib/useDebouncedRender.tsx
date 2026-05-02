"use client";

import { useEffect, useRef, useState } from "react";
import { renderEmail } from "@/email/render";
import { EmailDocument } from "@/email/EmailDocument";
import type { EmailData } from "@/email/schema";

/**
 * Render Puck data → email HTML. Debounced so we don't re-render on
 * every keystroke in a text field. We keep the LATEST data in a ref so
 * the in-flight render uses the freshest input even if multiple keys
 * landed during the debounce window.
 */
export function useDebouncedRender(data: EmailData, delayMs = 200): string {
  const [html, setHtml] = useState<string>("");
  const latest = useRef(data);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    latest.current = data;

    const run = async () => {
      if (inflight.current) return;
      inflight.current = true;
      try {
        const next = await renderEmail(<EmailDocument data={latest.current} />);
        setHtml(next);
      } catch (e) {
        console.error("render failed", e);
      } finally {
        inflight.current = false;
        // If data changed during the in-flight render, schedule another pass.
        if (latest.current !== data) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(run, 0);
        }
      }
    };

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, delayMs]);

  return html;
}
