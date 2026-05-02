# Nautilus Email Builder

A drag-and-drop email builder with live preview, Resend send, durable
scheduling, and an AI compose agent. Wrapped in an editorial
black-or-sand design language inspired by doublespeed.ai — Instrument
Serif italic for display, Geist Mono for technical labels, hairline
borders, electric-blue accent.

> Built for the Nautilus Engineering Full-Stack take-home.

---

## Quickstart

```bash
npm install
cp .env.example .env.local      # add RESEND_API_KEY + OPENAI_API_KEY
npm run dev                     # http://localhost:3000
```

`npm run dev` starts **both** the Next.js dev server and the Temporal
worker concurrently — no second terminal needed. Output lines are
prefixed `[next]` (blue) or `[worker]` (magenta).

For full scheduling locally, also start the Temporal dev binary in a
separate terminal:

```bash
brew install temporal           # one-time
temporal server start-dev       # http://localhost:8233 for the UI
```

The worker automatically retries with exponential backoff if Temporal
isn't running yet, so the order doesn't matter — Next.js stays alive
either way.

### Environment variables

| Variable | Required for | Default |
|---|---|---|
| `RESEND_API_KEY` | sending / scheduling | — |
| `RESEND_FROM_EMAIL` | sending | `onboarding@resend.dev` (Resend sandbox) |
| `OPENAI_API_KEY` | the Ask agent | — |
| `OPENAI_MODEL` | the Ask agent | `gpt-4o-mini` |
| `SCHEDULER` | scheduling backend | `temporal` locally, `resend` on Vercel (auto) |
| `TEMPORAL_ADDRESS` | scheduling | `localhost:7233` |
| `TEMPORAL_NAMESPACE` | scheduling | `default` |
| `TEMPORAL_TASK_QUEUE` | scheduling | `emails` |

---

## What's built

### Tier 1 — Must Have ✅
- Drag-and-drop builder (Puck v0.21) with React Email primitives:
  Heading, Text, Button, Image, Container, Section.
- Right sidebar property editing — colors, typography, sizing, image
  URLs, content, links, padding, alignment.
- Live preview — the canvas itself is the rendered email. Drag and edit
  on a faithful representation of the inbox view; same rendering goes
  out on send.
- Send via Resend with recipient + subject + status toasts.

### Tier 2 — Expected ✅
- **Email scheduling** — pluggable backend behind a `Scheduler`
  interface. Locally it uses Temporal (`startDelay` workflow with
  durable cancellation). On Vercel it auto-switches to Resend's native
  `scheduledAt` (zero infra). Both honor the same scheduled-list UI and
  cancel button. See [Decisions](#serverless-friendly-scheduling).
- **Desktop / mobile preview toggle** — the slider pill in the toolbar
  flips the canvas between full-width (desktop) and 380px (mobile).

### Tier 3 — Polish ✅
- **Undo / redo** via Puck's history (`createUsePuck` history selector).
  Toolbar buttons + ⌘Z / ⌘⇧Z.
- **Starter templates** — Blank / Welcome / Newsletter / Promo, ⌘K to
  open. Templates auto-recolor for the active theme on load.
- **Image upload** — base64 inline up to 200KB, custom Puck field with
  paste-URL fallback for larger images.
- **Dark / light theme** — pure black `#000` (dark) or warm sand
  `#ede4d0` (light), affects the entire builder shell.
- **Click-outside deselect** — Figma/Framer-style; a `click` listener
  (not `pointerdown`, which fights dnd-kit drag-init).
- **Theme-aware defaults on insert** — drag a Heading onto a dark canvas
  and it comes in white; drag onto a light canvas and it comes in ink.
  Implemented via Puck's `resolveData` + `metadata` flowing the current
  `contentBackground` into the resolver.
- **Image resize handles** — Google-Slides-style four-corner drag, with
  live width readout. Direction-aware math (drag a left corner left to
  grow). Result commits via `replace` action so it persists and shows
  in the sidebar Width field.
- **Keyboard shortcuts** — ⌘Z, ⌘⇧Z, ⌘K (templates), ⌘J (ask agent),
  ⌘↵ (send).
- **localStorage persistence** of the in-progress draft (debounced
  500ms). Refresh doesn't lose work.

### Tier 3 — Beyond the brief

#### `ask` agent (AI email composer) ✅

The `ask` button in the toolbar (or ⌘J) opens a glass modal with a
prompt textarea. Type a natural-language request — the model returns
valid Puck data and the canvas updates in place.

```
"thank-you email to my coworker Sam for shipping the migration this
week. Keep it warm, end with a CTA to read the postmortem."
```

**How it works**

```
src/components/AskAgent.tsx     ← the modal UI
src/app/api/agent/route.ts      ← POST handler
                                  ├─ reads OPENAI_API_KEY
                                  ├─ sends current EmailData + theme + prompt
                                  ├─ JSON-mode chat completion (no tools, no
                                  │  multi-step agent — just structured output)
                                  ├─ runtime validation (root + content shape)
                                  └─ id stamping that PRESERVES existing ids
                                     so incremental edits don't churn Puck's
                                     history
```

**Design rules baked into the system prompt**

- Always wrap content in a Section. Never floating Heading/Text/Button
  at the top level.
- Group related blocks into the same Section.
- Order within a Section: image → heading → text → button.
- Use Section paddingY for whitespace, not huge component margins.
- Theme-aware: the prompt branches on `isDark` and emits dark or light
  colors that match the canvas.
- Edit vs. compose mode: if the request modifies an existing email,
  preserve every existing item's id verbatim and touch only the props
  asked about. If it's a fresh request, generate from scratch.

**Why no agent framework**

A multi-step agent with tools (search the web, look up the user, etc.)
would be overkill. The task is structured generation: prompt + current
data + theme → JSON. One round-trip. JSON-mode + a tight system prompt
is cheaper and more predictable than tool-calling, and structured
outputs validation catches malformed responses cleanly.

**Note on `gpt-5`**

`temperature` is omitted from the API call because the latest OpenAI
models don't accept it. Default is `gpt-4o-mini` — bump to `gpt-5` /
`gpt-4o` via `OPENAI_MODEL` env if you want higher design quality.

---

## Architecture

### The bridge between Puck and React Email

> The PDF calls this out as the most architecturally interesting decision:
> "How you map [the editor] onto [React Email] is the most architecturally
> interesting decision you'll make, and it's where we'll focus our review."

**Single source of truth = the prop schema, NOT the render path.**

```
src/email/schema.ts          ← Zod schemas + TS types — ONE definition.
                               Drives Puck `fields`, Puck `defaultProps`,
                               and React Email primitive prop types.

src/email/primitives.tsx     ← React Email components (Heading, Text,
                               Button, Image, Container, Section).
                               Canonical render path — fed through
                               @react-email/render to produce inbox HTML.

src/builder/puckRenderers.tsx← Plain-HTML mirrors for the Puck CANVAS
                               (browser DOM). Visually faithful.

src/builder/puckConfig.tsx   ← Builds Puck `Config` from schema +
                               canvas renderers. Plus `resolveData`
                               hooks for theme-aware defaults.

src/email/EmailDocument.tsx  ← Walks Puck's saved JSON and renders
                               the React Email tree. Used by every
                               send + schedule path.
```

#### Why two renderers, not one

React Email primitives compile to `<table>`-based MSO-conditional markup
designed to be serialized by `render()`. Mounting them directly in a
browser DOM tree throws hydration warnings on `<Html>`/`<Head>`/`<Body>`
and drifts visually for the table-wrapped layout primitives. So I share
the *prop schema* and split the *render path* — the canvas is a
structural editor with browser-faithful renderers; send / schedule both
go through the canonical React Email path.

#### One canvas, no separate preview pane

I shipped an iframe preview pane in v1, then merged it into the canvas
when the structural renderers turned out faithful enough. The canvas
itself is now the truthful preview — drag onto it, see exactly what
ships. Less screen real estate burned, less mental overhead.

---

## Decisions and tradeoffs

### Serverless-friendly scheduling

The PDF flagged Temporal as hard to deploy serverless. So I built a
`Scheduler` interface with two implementations:

| Backend | Where | How |
|---|---|---|
| Temporal | local dev / always-on hosts | `startDelay` workflow → activity → Resend. Durable, cancellable, full execution history. |
| Resend native | Vercel / serverless | `resend.emails.send({ ..., scheduledAt: ISO })`. Resend stores the rendered HTML and fires it. Cancel via `resend.emails.cancel(id)`. |

`SCHEDULER` env var picks; on Vercel `VERCEL=1` auto-selects Resend.
Both paths persist a row in `scheduledStore.ts` (file-backed locally,
ephemeral on Vercel — would graduate to Vercel KV / Postgres in
production). The Temporal code is fully implemented per the PDF's
expectation, the Resend path makes the deployed demo actually work.

### Snapshotting at schedule time

Both schedulers freeze the email at the moment you click `queue`. For
Temporal that means the workflow's args (durably persisted by the
server). For Resend it's even tighter — we render to HTML right then
and ship the string to Resend; from there it's entirely out of our
hands. So you can keep editing the canvas freely without affecting any
queued send.

### Puck (`@puckeditor/core` v0.21) over Craft.js / GrapesJS / dnd-kit

Puck is declarative — register components by name with `fields`,
`defaultProps`, `render` — which makes the bridge to React Email a
~150-line config file. GrapesJS owns its DOM with iframe sandboxing
and would force a translation layer. dnd-kit is too low-level — I'd be
rebuilding Puck.

### Temporal `startDelay` over `workflow.sleep`

Earlier examples show `await sleep(target - now)` inside the workflow
body. That works but pins a workflow to a worker for the entire delay.
v1.15+ supports `startDelay` on `workflow.start()` — the workflow
doesn't get assigned to a worker until the delay elapses. Cancellation
before then never wakes a worker. Cleaner semantics for one-off
scheduled work.

### `tsx --env-file-if-exists` for the worker

`next dev` auto-loads `.env` / `.env.local`. The standalone `tsx`
worker process doesn't, which silently broke scheduled sends because
the activity called `new Resend(undefined)`. Fixed by passing
`--env-file-if-exists=.env --env-file-if-exists=.env.local` to tsx so
the worker has identical environment.

### Image upload: no real storage

Real CDN upload is a 1–2 hour rabbit hole for a take-home. So:
- **Paste a public URL** is the recommended path.
- **Upload (≤200KB)** embeds as a base64 `data:` URI. Works in most
  clients for small images; capped client-side with a clear error.

### Click-outside via `click`, not `pointerdown`

I first wired `pointerdown` for click-outside-deselect. Drag-and-drop
broke immediately — dnd-kit *also* listens on `pointerdown` to start
drags, and my listener was disrupting it. Switched to `click`: click
only fires after a release without a drag, so it never enters the path
during a drag-start.

### Light = sand, not white

The light theme is warm sand `#ede4d0`, not bare white. Reads more like
kraft paper / agenda-book editorial than "default Tailwind app" white.
Inspired directly by doublespeed.ai's typography-driven dark and
[some Bauhaus revivalist tendencies] for light.

### What's NOT here (deliberate cuts)

- Real image upload to a CDN.
- Email-client dark-mode delivery (not the same as the builder's dark
  theme — email-client dark mode is a CSS-support nightmare).
- Auth, multi-user, multi-template-save.
- Custom-position-within-section drag (would lie about real email
  rendering — emails use `<table>` flow, not absolute positioning).

---

## Project layout

```
src/
  app/
    layout.tsx              ← root metadata + fonts
    globals.css             ← theme tokens, glass utilities, Puck overrides
    page.tsx                ← App shell + state orchestration
    api/
      send/route.ts         ← POST → render → Resend
      schedule/route.ts     ← GET (list), POST (start via scheduler)
      schedule/[id]/route.ts← DELETE (cancel)
      agent/route.ts        ← POST → OpenAI → validated EmailData
  email/
    schema.ts               ← Zod schemas, prop types, EmailData/EmailNode
    primitives.tsx          ← React Email components (canonical render)
    EmailDocument.tsx       ← Walks Puck JSON → React Email tree
    render.ts               ← @react-email/render wrapper
    renderEmailHtml.tsx     ← JSX entry point used by .ts route handlers
  builder/
    puckRenderers.tsx       ← Browser-DOM canvas mirrors + image resize
    puckConfig.tsx          ← Puck Config + resolveData theme defaults
    templates.ts            ← Blank/Welcome/Newsletter/Promo + adapt to theme
    ImageSourceField.tsx    ← Custom Puck field: URL or base64 upload
  components/
    Toolbar.tsx             ← Top bar (To, Subject, Send, Ask, Schedule, …)
    EditorBridge.tsx        ← Puck wrapper + history exposure + ⌘Z/⌘⇧Z
    AskAgent.tsx            ← AI compose modal
    TemplatesModal.tsx      ← Template picker modal
    ScheduledDrawer.tsx     ← Queue drawer with cancel
    glass/
      Glass.tsx             ← GlassSurface, GlassButton, GlassInput, …
      Toast.tsx             ← Toast provider/hook
  lib/
    scheduler.ts            ← Scheduler interface + Temporal & Resend impls
    scheduledStore.ts       ← File-backed JSON store (ephemeral on Vercel)
    usePersistedData.ts     ← localStorage save/load
  temporal/
    shared.ts               ← Cross-boundary types
    workflows.ts            ← scheduledSendWorkflow (deterministic)
    activities.ts           ← sendScheduledEmail activity
    worker.ts               ← Worker with retry-on-disconnect
    client.ts               ← Singleton Temporal client factory
data/
  scheduled.json            ← Scheduled-row store (gitignored, dev only)
```

---

## Assumptions

- Temporal is hard to deploy serverless. The deployed demo (Vercel)
  uses Resend's native scheduling — the PDF allows this. The Temporal
  codebase is complete for local execution.
- The Resend sandbox `from` (`onboarding@resend.dev`) is enough for the
  demo. Domain verification is needed to send to non-owned addresses.
- The OpenAI API key powers the Ask agent only. Without it the rest of
  the app works fine; ask-anything just shows a clean error toast.

---

## Time spent

Spent around three hours. Started at 1:00, ended around 4:00 CST.

---

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Puck Editor](https://puckeditor.com)
- [React Email](https://react.email)
- [Resend](https://resend.com) — including [scheduledAt](https://resend.com/docs/dashboard/emails/schedule-email)
- [Temporal TypeScript SDK](https://typescript.temporal.io)
- [OpenAI Node SDK](https://github.com/openai/openai-node)
