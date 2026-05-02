/**
 * Walks rendered email HTML, pulls every base64 `data:image/...` src
 * out of the body, and replaces it with a `cid:...` reference plus a
 * matching attachment entry that Resend ships as an inline part.
 *
 * Why: a raw `data:` URI in <img src> bloats the HTML body (Gmail clips
 * past ~102KB) AND many clients still block remote images by default
 * if you go the URL route, so the recipient sees alt text instead of
 * the actual image. CID-attached inline images render automatically in
 * every major client.
 *
 * URL-referenced images (`<img src="https://...">`) are left alone —
 * those are still subject to "display images below" prompts, which is
 * standard email behavior.
 */

export type InlineAttachment = {
  filename: string;
  content: string; // base64
  contentId: string;
  contentType: string;
};

export type InlineExtractResult = {
  html: string;
  attachments: InlineAttachment[];
};

const DATA_URI_SRC =
  /src=(["'])data:image\/([a-z0-9+]+);base64,([^"']+)\1/gi;

export function extractInlineImages(html: string): InlineExtractResult {
  const attachments: InlineAttachment[] = [];
  let i = 0;

  const processed = html.replace(
    DATA_URI_SRC,
    (_match, quote: string, ext: string, base64: string) => {
      i += 1;
      const contentId = `inline-${i}`;
      // Strip "+xml" from things like svg+xml so the filename is sensible.
      const cleanExt = ext.toLowerCase().replace(/\+xml$/, "");
      return `src=${quote}cid:${contentId}${quote}` + (() => {
        attachments.push({
          filename: `image-${i}.${cleanExt}`,
          content: base64,
          contentId,
          contentType: `image/${ext}`,
        });
        return "";
      })();
    },
  );

  return { html: processed, attachments };
}
