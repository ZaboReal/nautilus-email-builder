"use client";

import { useEffect, useRef, useState } from "react";

type Device = "desktop" | "mobile";

const DEVICE_WIDTH: Record<Device, number> = {
  desktop: 640,
  mobile: 380,
};

type Props = {
  html: string;
  device: Device;
};

/**
 * iframe with a debounced srcDoc swap. We deliberately keep ONE iframe
 * element across renders (only `srcDoc` changes) so the user's scroll
 * position inside the preview is preserved across edits.
 */
export function PreviewFrame({ html, device }: Props) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [width, setWidth] = useState(DEVICE_WIDTH[device]);

  useEffect(() => {
    setWidth(DEVICE_WIDTH[device]);
  }, [device]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // srcDoc is the rendered email HTML — already a complete document.
    // sandbox="allow-same-origin" disables script execution from user
    // content while still allowing the iframe to compute layout.
    if (el.srcdoc !== html) el.srcdoc = html;
  }, [html]);

  return (
    <div className="flex flex-col items-center gap-3 h-full overflow-auto glass-scroll p-6">
      <div
        className="rounded-xl overflow-hidden ring-1 ring-white/10 shadow-[0_30px_120px_-40px_rgba(0,153,255,0.18)] transition-[width] duration-300 ease-out"
        style={{ width, height: "100%", maxHeight: "calc(100vh - 180px)" }}
      >
        <iframe
          ref={ref}
          title="Email preview"
          sandbox="allow-same-origin"
          className="w-full h-full bg-white"
          style={{ border: "none" }}
        />
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
        {device === "desktop" ? "desktop · 640px" : "mobile · 380px"}
      </div>
    </div>
  );
}
