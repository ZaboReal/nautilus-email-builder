# Nautilus Email Builder

A drag-and-drop email builder with live preview, Resend send, durable
scheduling, and an AI compose agent.

> Built for the Nautilus Engineering Full-Stack take-home.

---

## Quickstart

```bash
npm install
cp .env.example .env.local      # add RESEND_API_KEY + OPENAI_API_KEY
npm run dev                     # http://localhost:3000
```

`npm run dev` starts both the Next.js dev server and the Temporal
worker concurrently. Output is prefixed `[next]` (blue) and `[worker]`
(magenta).

For full scheduling locally, also start the Temporal dev binary:

```bash
brew install temporal           # one-time
temporal server start-dev       # http://localhost:8233 (Web UI)
```

The worker auto-retries on connection failure, so order doesn't matter.

### Environment variables

| Variable | Required for | Default |
|---|---|---|
| `RESEND_API_KEY` | sending / scheduling | — |
| `RESEND_FROM_EMAIL` | sending | `onboarding@resend.dev` |
| `OPENAI_API_KEY` | the Ask agent | — |
| `OPENAI_MODEL` | the Ask agent | `gpt-4o-mini` |
| `SCHEDULER` | scheduler backend | `temporal` locally, `resend` on Vercel |
| `TEMPORAL_ADDRESS` | scheduling | `localhost:7233` |
| `TEMPORAL_NAMESPACE` | scheduling | `default` |
| `TEMPORAL_TASK_QUEUE` | scheduling | `emails` |

---

## Features

### Tier 1
- Drag-and-drop builder (Puck v0.21) with React Email primitives:
  Heading, Text, Button, Image, Container, Section.
- Right sidebar property editing — colors, typography, sizing, image
  URLs, content, links, padding, alignment.
- Live preview — the canvas itself is the rendered email. What you
  drag onto is what gets sent.
- Send via Resend with recipient + subject + status toasts.

### Tier 2
- **Scheduling** — pluggable backend behind a `Scheduler` interface.
  Locally: Temporal (`startDelay` workflow, durable, cancellable).
  Serverless: Resend's native `scheduledAt` (zero infra).
- **Desktop / mobile preview** — slider toggle in the toolbar.

### Tier 3
- Undo / redo (left palette + ⌘Z / ⌘⇧Z).
- Reset button to clear the canvas in one click.
- Starter templates: Blank / Welcome / Newsletter / Promo (⌘K). Auto-
  recolor for the active theme on load.
- Image upload — base64 inline up to 200KB, paste-URL fallback.
- Dark / light theme — pure black or warm sand, full-shell cascade.
- Click-outside-deselect.
- Theme-adaptive defaults on insert (drag a Heading onto dark canvas
  → arrives white; light canvas → ink).
- Image resize via four-corner drag, with live width readout.
- Keyboard shortcuts: ⌘Z, ⌘⇧Z, ⌘K (templates), ⌘J (ask), ⌘↵ (send).
- localStorage draft persistence.

### Beyond the brief: the `ask` AI agent

Toolbar button + ⌘J. Type a natural-language request — the model
returns valid Puck JSON and the canvas updates in place.

```
"thank-you email to my coworker Sam for shipping the migration this
week. Keep it warm, end with a CTA to read the postmortem."
```

- Edit-vs-compose dual mode: modifying an existing email preserves
  every existing item's id; new requests generate from scratch.
- Theme-aware: the prompt branches on `isDark` and emits matching
  colors.
- Design rules in the system prompt: always wrap content in a Section,
  group related blocks, image → heading → text → button.
- One round-trip with JSON-mode + structured-output validation. No
  multi-step agent — it would be overkill for structured generation.

---

## Architecture

### The bridge between Puck and React Email

> The PDF calls this out as the most architecturally interesting decision.

**Single source of truth = the prop schema, NOT the render path.**

```
src/email/schema.ts          ← Zod schemas + TS types — ONE definition.
                               Drives Puck `fields`, Puck `defaultProps`,
                               and React Email primitive prop types.

src/email/primitives.tsx     ← React Email components. Canonical render
                               path — fed through @react-email/render to
                               produce inbox HTML.

src/builder/puckRenderers.tsx← Plain-HTML mirrors for the canvas
                               (browser DOM). Visually faithful.

src/builder/puckConfig.tsx   ← Builds Puck `Config` from schema +
                               canvas renderers. `resolveData` hooks
                               for theme-aware defaults.

src/email/EmailDocument.tsx  ← Walks Puck's saved JSON, renders the
                               React Email tree. Used by every send +
                               schedule path.
```

**Why two renderers, not one:** React Email primitives compile to
`<table>`-based MSO-conditional markup designed to be serialized by
`render()`. Mounting them directly in a browser DOM tree throws
hydration warnings on `<Html>`/`<Head>`/`<Body>` and drifts visually
for the table-wrapped layout primitives. So the *prop schema* is shared
and the *render path* is split — the canvas is a structural editor with
browser-faithful renderers; send and schedule both go through the
canonical React Email path. The canvas itself is the truthful preview
(no separate iframe pane).

---

## Decisions and tradeoffs

### Serverless-friendly scheduling

The PDF flagged Temporal as hard to deploy serverless. So the
`Scheduler` interface has two implementations:

| Backend | Where | How |
|---|---|---|
| Temporal | local dev | `startDelay` workflow → activity → Resend. Durable, cancellable, full execution history. |
| Resend native | Vercel / serverless | `resend.emails.send({ ..., scheduledAt: ISO })`. Resend stores the rendered HTML and fires it. Cancel via `resend.emails.cancel(id)`. |

`SCHEDULER` env var picks; on Vercel `VERCEL=1` auto-selects Resend.
Temporal stays fully implemented per the PDF's expectation; the Resend
path makes the deployed demo actually work.

### Snapshotting at schedule time

Both schedulers freeze the email when you click `queue`. Temporal
serializes the workflow's args. Resend takes the rendered HTML and
keeps it on their side. You can keep editing the canvas freely without
affecting any queued send.

### Temporal `startDelay` over `workflow.sleep`

Older examples show `await sleep(target - now)` inside the workflow
body. That works but pins a workflow to a worker for the entire delay.
v1.15+ supports `startDelay` on `workflow.start()` — the workflow
isn't assigned to a worker until the delay elapses. Cancellation
before then never wakes one.

### Image upload: no real CDN

Real CDN upload is a 1–2 hour rabbit hole for a take-home. So:
- Paste a public URL is the recommended path (and what Gmail/Outlook
  prefer — they block remote images by default until the recipient
  opts in).
- Upload (≤200KB) embeds as a base64 `data:` URI. Works in most
  clients for small images; capped client-side to keep emails under
  Gmail's ~102KB clip threshold for HTML body.

### Auto-status for stale pending rows

Resend native scheduling doesn't push a delivery callback to us. So on
every list refresh, rows whose `scheduledFor + 5s` has passed and that
are still pending are reaped to `sent`. Temporal rows transition via
the activity itself.

---

## Project layout

```
src/
  app/
    layout.tsx              ← root metadata + fonts
    globals.css             ← theme tokens, utilities, Puck overrides
    page.tsx                ← App shell + state orchestration
    api/
      send/route.ts         ← POST → render → Resend
      schedule/route.ts     ← GET (list), POST (start via scheduler)
      schedule/[id]/route.ts← DELETE (cancel + remove)
      agent/route.ts        ← POST → OpenAI → validated EmailData
  email/
    schema.ts               ← Zod schemas, prop types, EmailData
    primitives.tsx          ← React Email components (canonical render)
    EmailDocument.tsx       ← Walks Puck JSON → React Email tree
    render.ts               ← @react-email/render wrapper
    renderEmailHtml.tsx     ← JSX entry for .ts route handlers
  builder/
    puckRenderers.tsx       ← Browser-DOM canvas mirrors + image resize
    puckConfig.tsx          ← Puck Config + resolveData theme defaults
    templates.ts            ← Blank/Welcome/Newsletter/Promo
    ImageSourceField.tsx    ← Custom Puck field: URL or base64 upload
  components/
    Toolbar.tsx             ← Top bar (To, Subject, Send, Ask, …)
    EditorBridge.tsx        ← Puck wrapper, hotkeys, left-panel header
    AskAgent.tsx            ← AI compose modal
    TemplatesModal.tsx      ← Template picker
    ScheduledDrawer.tsx     ← Queue with cancel / clear
    glass/                  ← Reusable surface + button + toast
  lib/
    scheduler.ts            ← Scheduler interface + Temporal & Resend
    scheduledStore.ts       ← Local file-backed JSON store
    usePersistedData.ts     ← localStorage save/load
  temporal/
    workflows.ts            ← scheduledSendWorkflow (deterministic)
    activities.ts           ← sendScheduledEmail activity
    worker.ts               ← Worker with retry-on-disconnect
    client.ts               ← Singleton Temporal client factory
```

---

## Time spent

Spent around three hours. Started at 1:00, ended around 4:00 CST.

---

## Resources

- [Next.js](https://nextjs.org/docs)
- [Puck Editor](https://puckeditor.com)
- [React Email](https://react.email)
- [Resend](https://resend.com) — including [scheduledAt](https://resend.com/docs/dashboard/emails/schedule-email)
- [Temporal TypeScript SDK](https://typescript.temporal.io)
- [OpenAI Node SDK](https://github.com/openai/openai-node)
