"use client";

import { FieldLabel } from "@puckeditor/core";
import { useState } from "react";

const MAX_BYTES = 200 * 1024;

type Props = {
  value: string;
  onChange: (next: string) => void;
};

/**
 * Puck custom field for an image source. Two paths:
 *   1. Paste a public URL (best for production emails — most clients
 *      block remote images by default until the recipient opts in).
 *   2. Upload a file <= 200KB → embedded as base64 data URI.
 *
 * Why no real upload? Take-home scope. A real S3/presigned-URL pipeline
 * is 1-2 hours of yak shaving for a feature most users won't touch.
 * The base64 path works in most clients for small images and is honest
 * about its limits.
 */
export function ImageSourceField({ value, onChange }: Props) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | null) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setStatus(
        `Too big: ${Math.round(file.size / 1024)}KB. Max ${MAX_BYTES / 1024}KB. Paste a public URL instead.`,
      );
      return;
    }
    setBusy(true);
    setStatus("Encoding…");
    try {
      const dataUrl = await readAsDataUrl(file);
      onChange(dataUrl);
      setStatus(`Embedded ${Math.round(file.size / 1024)}KB as base64.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldLabel label="Image source">
      <div className="flex flex-col gap-2 w-full">
        <input
          type="text"
          value={value.startsWith("data:") ? "(base64 embedded)" : value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={value.startsWith("data:")}
          placeholder="https://… or upload below"
          className="glass-input px-2 py-1.5 text-xs w-full"
        />
        <label className="glass-button px-2 py-1.5 text-xs cursor-pointer w-full text-center">
          {busy ? "Uploading…" : "Upload (≤200KB)"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
        {value.startsWith("data:") ? (
          <button
            type="button"
            className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] text-left"
            onClick={() => onChange("")}
          >
            Clear and paste a URL instead
          </button>
        ) : null}
        {status ? (
          <div className="text-[11px] text-[var(--fg-muted)]">{status}</div>
        ) : null}
      </div>
    </FieldLabel>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("Couldn't read file."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed."));
    reader.readAsDataURL(file);
  });
}
