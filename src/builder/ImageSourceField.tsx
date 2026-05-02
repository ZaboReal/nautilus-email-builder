"use client";

import { FieldLabel } from "@puckeditor/core";
import { useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB — generous because uploads
// no longer end up in the HTML body; the send pipeline detaches every
// data: URI into a CID inline attachment, which Resend ships as a
// separate MIME part. So body size is unaffected and recipients see
// the image inline without "display images below" prompts.

type Props = {
  value: string;
  onChange: (next: string) => void;
};

/**
 * Puck custom field for an image source. Two paths:
 *   1. Paste a public URL — recipient may need to "display images"
 *      (Gmail/Outlook default-block remote images).
 *   2. Upload a file (≤5MB) — encoded as base64 in the editor, then
 *      detached into a CID inline attachment by the send pipeline so
 *      it renders inline in every major client.
 */
export function ImageSourceField({ value, onChange }: Props) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | null) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setStatus(`Too big: ${mb}MB. Max 5MB. Paste a public URL instead.`);
      return;
    }
    setBusy(true);
    setStatus("Encoding…");
    try {
      const dataUrl = await readAsDataUrl(file);
      onChange(dataUrl);
      const kb = Math.round(file.size / 1024);
      setStatus(
        kb >= 1024
          ? `Embedded ${(kb / 1024).toFixed(1)}MB · sent inline.`
          : `Embedded ${kb}KB · sent inline.`,
      );
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
          value={value.startsWith("data:") ? "(uploaded · sent inline)" : value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={value.startsWith("data:")}
          placeholder="https://… or upload below"
          className="glass-input px-2 py-1.5 text-xs w-full"
        />
        <label className="glass-button px-2 py-1.5 text-xs cursor-pointer w-full text-center">
          {busy ? "Uploading…" : "Upload (≤5MB)"}
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
