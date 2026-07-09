---
name: managing-summary-canvas
description: Opens, refreshes, adds tasks to, and reads state from a reusable conversation summary canvas — a side-panel Markdown view with a linked issue header, pinned action items, a collapsed build-notes section, a learnings section, and an always-visible reviewer verdict matrix — for tracking and resuming engineering work across sessions. Use when the user explicitly asks to open, show, or update the conversation summary canvas, to add a task or action item to it, to check off or close out an existing task on it, or to ask how many tasks are left or what's still open on it.
---

# Managing the Summary Canvas

Opens or refreshes a reusable **conversation summary canvas** — a side-panel
view that lets an engineer track and resume work across sessions without
hunting through chat history or committing scratch files to a repo.

## When to Use

Only when the user **explicitly** asks for it, e.g.:
- "open the conversation summary canvas"
- "show a summary canvas for this work"
- "update the conversation summary canvas" (and close variants)
- "add a task for <description>" (and close variants, e.g. "add an action
  item for...") — appends a new, unchecked Action Item to the currently open
  canvas instance. See "Adding a single task" below.
- "how many tasks are left?", "what's left on the canvas?", "close off
  <task>" (and similar questions about the canvas's current Action Items) —
  read the canvas's live state instead of relying on conversation memory.
  See "Reading the canvas" below.

Never open or refresh this canvas proactively/automatically. It is
user-invoked only.

## Underlying mechanism

The canvas is implemented by the `conversation-summary-canvas` extension
committed alongside this skill at `.github/skills/managing-summary-canvas/extension/`.
It is a **generic Markdown renderer** with two actions, `update_markdown`
(write) and `get_state` (read) — it does not enforce section structure
itself. This skill is what enforces the structure, by controlling the
Markdown you generate before calling `open_canvas` / `invoke_canvas_action`.

### 1. Ensure the extension is installed (user scope)

Check `extensions_manage({ operation: "list" })` for an extension named
`conversation-summary-canvas`. If it is not present, install it from this
repo folder at **user scope** (so it persists across every session, matching
the "reusable across sessions" goal — "session-scoped" here refers to a
given canvas *instance's content*, not the extension's install location).
`install_extension`'s `name` override **must** be passed explicitly here —
without it, the tool defaults to the URL's last path segment (`extension`),
not `conversation-summary-canvas`, so the extension would install under the
wrong folder/extensionId and never be found by the check above:

```
install_extension({
  url: "https://github.com/<owner>/<repo>/tree/<ref>/.github/skills/managing-summary-canvas/extension",
  scope: "user",
  name: "conversation-summary-canvas"
})
```

Then call `extensions_reload` if it wasn't picked up automatically.

**Verification.** `extension/verify.test.mjs` is a committed, runnable
structural test (`node --test .github/skills/managing-summary-canvas/extension/verify.test.mjs`)
that renders a realistic full-shape document through the real renderer and
asserts the layout invariants below still hold. Run it after any change to
`markdown.mjs` or the section conventions in this file, so "reload and
verify" leaves a reproducible, committed artifact instead of relying on
one-off interactive testing:
- the header renders as a working link containing the issue number
- Action Items appears directly below the header
- "What Was Built" collapses via `<details>`/`<summary>`
- the Reviewer Matrix renders as a table (including a pending row) above
  "What We Learned"
- `summarizeActionItems` agrees with the checkbox states in the document

### 2. Resolve a `documentId` and a backing issue

Every canvas instance needs a stable `documentId` independent of the panel
(e.g. `issue-42`) so reopening it, or a second panel on the same document,
shows the same content.

The header always needs something to link to. If the work being summarized
has no backing GitHub issue yet, **create one first** (via `create_issue` or
the equivalent repo convention) — don't invent a "no issue" fallback for the
header.

### 3. Compose the Markdown

Always structure the Markdown in this order. Do not bury Action Items or
omit the reviewer matrix.

```markdown
## [#<issue-number>](<issue-url>) — <issue title>
<one-sentence summary of the work>

## Action Items
- [ ] <actionable item>
- [ ] <actionable item>

<details>
<summary>What Was Built</summary>

- <bullet, 3-5 max — full detail already lives in the PR diff>
</details>

## Reviewer Matrix

| Reviewer | Safe to Merge | Closes Scope |
|---|---|---|
| Claude Opus | ⏳ Not yet reviewed | ⏳ Not yet reviewed |
| GPT-5.x | ⏳ Not yet reviewed | ⏳ Not yet reviewed |
| Gemini | ⏳ Not yet reviewed | ⏳ Not yet reviewed |

## What We Learned
<insights / gotchas discovered during the work that aren't in the PR>
```

Rules:
- **Header** — issue number linked to the GitHub issue URL, issue title, one
  sentence of context. Always first.
- **Action Items** — pinned directly below the header. Real, actionable
  items only. This is also where reviewer feedback lives (see below) —
  don't duplicate it in the matrix. The canvas automatically renders open
  items first, then a "Completed" divider, then checked-off items — so
  when checking an item off in the source Markdown, just flip its
  `- [ ]`/`- [x]` marker in place; don't manually reorder the list, the
  canvas regroups it for display.
- **What Was Built** — collapsed via `<details>`/`<summary>`, capped at 3-5
  bullets. The PR diff already has full detail; don't duplicate it here.
- **Reviewer Matrix** — placed directly after "What Was Built" and above
  "What We Learned". Always rendered, even before any review has happened.
  Show a "Not yet reviewed" pending state per reviewer/column rather than
  omitting the section. Two verdict columns, kept separate because they're
  different reviewer questions:
  - **Safe to Merge** — is the code itself correct/secure (bugs, security,
    lifecycle correctness)?
  - **Closes Scope** — does the PR satisfy the full scope of the backing
    issue's action items/requirements? (Not "does the code have bugs" —
    a PR can be bug-free but still leave requirements unaddressed, or vice
    versa.)

  Fill each cell with only a status: ✅ Pass / ❌ Fail / ⚠️ Pass with
  concerns. The matrix is a status board, not a place for prose — it should
  stay scannable at a glance with no per-reviewer comment column. If a
  reviewer's verdict is based on an earlier commit than what's currently on
  the branch, encode that in the status itself (e.g. a distinct pending/
  stale marker) rather than adding a text column to explain it.

  Any actual finding, concern, or comment a reviewer raises — whether it's
  still open or was fixed — goes into **Action Items** instead, as its own
  line attributed to that reviewer by name, e.g.:
  `- [x] (Claude Opus 4.8) Fixed a URL-scheme allow-list bypass via a
  leading C0 control character before \`javascript:\` — sanitized and
  regression-tested.`
  `- [ ] (GPT-5.5) Missing \`name\` param in the \`install_extension\`
  example would install under the wrong folder.`
  Check the box once the concern is resolved and verified, same as any
  other action item; leave it unchecked while still outstanding. This way
  the matrix always answers "is it green" at a glance, and Action Items
  is the one place with the actual substance and history of what reviewers
  found.
- **What We Learned** — last section. New insights/gotchas not captured
  elsewhere.

### 4. Open or refresh

- **First time for this `documentId`:**
  `open_canvas({ canvasId: "conversation-summary-canvas", instanceId: "<pick-one>", input: { documentId, title: "<issue title>", markdown } })`
- **"Update the conversation summary canvas" (or close variants), and an
  instance is already open for this `documentId`:**
  `invoke_canvas_action({ instanceId: "<same instance>", actionName: "update_markdown", input: { markdown } })`

Recompose the full Markdown each time (the action replaces the whole
document) — don't try to patch fragments in place.

## Adding a single task

Trigger: "add a task for <description>" (and close variants like "add an
action item for...", "track a task to..."). This is a lightweight variant of
step 4's refresh flow, scoped to one Action Items line instead of a full
recompose of every section.

1. Identify which open canvas instance the task belongs to. If exactly one
   `conversation-summary-canvas` instance is open, use it. If several are
   open, ask the user which one (or which `documentId`) unless they've made
   it obvious from context.
2. Get the canvas's current full Markdown via `invoke_canvas_action({ instanceId, actionName: "get_state" })`
   — don't guess or reconstruct it from conversation memory, which may be
   stale or gone after context compaction/a new session.
3. Decide where the new item goes in the `## Action Items` list. This is a
   deliberately lightweight substitute for a real dependency graph — no
   "depends on" tracking, no separate data structure, just a placement
   judgment made fresh each time a task is added:
   - **Default: append it as the last item** in the list.
   - **Before finalizing that default, check the existing *open*
     (unchecked) items only** (skip anything already checked off — it's
     done, it can't be blocked): does the new task read as something that
     has to happen *before* one of them can reasonably be started (e.g. it
     produces something that item needs, or is an obvious precondition)?
     Judge this from the plain meaning of the task text — don't build or
     persist any dependency structure to justify it.
   - **If yes**, insert the new item immediately *above* the earliest open
     item it blocks, instead of at the end, so that item isn't silently
     stuck behind something added later.
   - **If it's genuinely unclear** whether the new task blocks (or is
     blocked by) an existing open item — not just "could go earlier or
     later with no consequence," but actually ambiguous whether skipping
     it would leave an open item unstartable — ask the user where to place
     it (e.g. "before item N" vs. "at the end") rather than guessing.
   - The goal this preserves: the **topmost open item should always be
     something the user can actually start right now**. Never let adding a
     task silently leave an earlier open item blocked by it.
4. Insert as `- [ ] <description>` at the position decided above. Leave
   every other section, and the relative order of every other Action Item,
   untouched.
5. Call `invoke_canvas_action({ instanceId: "<that instance>", actionName: "update_markdown", input: { markdown: "<full markdown with the new item inserted>" } })`.
6. Do not reset checked items, reorder existing items beyond the single
   insertion above, or touch other sections (What Was Built, What We
   Learned, Reviewer Matrix) when doing this — only the Action Items list
   changes, and only by adding the one new line.

Example: "add a task for getting the groceries" against a canvas whose
Action Items list currently ends with
`- [ ] Review this canvas render (header link, action items placement, reviewer matrix)`
should append `- [ ] Getting the groceries` as a new line directly after it,
then push the whole updated document via `update_markdown`.

Example (blocking case): the Action Items list currently reads
`- [ ] Write the deployment doc` then `- [ ] Deploy to production`, and the
user says "add a task to get sign-off from the security team first". This
new task is a plain-meaning prerequisite for "Deploy to production" (you
can't deploy before sign-off), so it's inserted *above* that item rather
than appended to the end:
`- [ ] Write the deployment doc`, `- [ ] Get sign-off from the security team`,
`- [ ] Deploy to production`. "Write the deployment doc" is untouched and
stays the topmost, still-startable item.

## Reading the canvas

Trigger: any question about the canvas's current state — "how many tasks
are left?", "what's still open?", "close off <task>" / "check off <task>"
(mark an existing item done rather than adding a new one), or anything else
that requires knowing what's actually on the canvas right now rather than
what you last remember sending it.

1. Call `invoke_canvas_action({ instanceId, actionName: "get_state" })`. It
   returns the full current `markdown`, plus a pre-parsed `actionItems`
   summary: `{ items: [{ text, done }], total, done, remaining }` scoped to
   the `## Action Items` section specifically.
2. Always call this before answering a question about canvas state or
   editing an existing item (checking one off, rewording it, removing it) —
   never answer from conversation memory alone. Memory can be stale (an
   earlier `update_markdown` call from a different turn, a compacted
   context, or a fresh session that never saw the prior state).
3. For "how many tasks are left?" — answer directly from `remaining`
   (optionally naming the still-open items from `items`).
4. For "close off <task>" / "check off <task>" — get state, find the
   matching item in the Markdown, flip its checkbox from `- [ ]` to
   `- [x]` in place (don't reorder or touch other sections), then call
   `update_markdown` with the full amended document, same as "Adding a
   single task" above.

