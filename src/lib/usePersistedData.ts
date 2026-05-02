"use client";

import { useEffect, useRef, useState } from "react";
import type { EmailData } from "@/email/schema";

const STORAGE_KEY = "nautilus.email.draft.v1";

/**
 * Load Puck data from localStorage on mount, and persist back on every
 * change (debounced). Returns [data, setData, ready] — `ready` is true
 * once we've completed the initial load (avoid clobbering with the
 * default seed before localStorage is read).
 */
export function usePersistedData(initial: EmailData) {
  const [data, setData] = useState<EmailData>(initial);
  const [ready, setReady] = useState(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Hydrating from an external store (localStorage) on mount — exactly
    // the "synchronize with external system" use case `useEffect` is for.
    // The lint rule's preferred lazy-init pattern won't work because
    // `localStorage` doesn't exist on the server; reading it during
    // initial render would mismatch SSR.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EmailData;
        if (parsed && Array.isArray(parsed.content)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setData(parsed);
        }
      }
    } catch {
      // ignore — fall back to initial.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // quota or private mode — silently drop.
      }
    }, 500);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [data, ready]);

  return { data, setData, ready };
}

export function clearPersistedDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
