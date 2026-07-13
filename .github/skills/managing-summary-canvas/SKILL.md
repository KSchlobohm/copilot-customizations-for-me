---
name: managing-summary-canvas
description: Opens, refreshes, adds tasks to, and reads state from a reusable conversation summary canvas — a side-panel Markdown view with a linked issue header, pinned action items, collapsed build notes, learnings, and a work-type-appropriate reviewer verdict matrix — for tracking and resuming work across sessions. Use when the user explicitly asks to open, show, or update the conversation summary canvas, to add a task or action item to it, to check off or close out an existing task on it, or to ask how many tasks are left or what's still open on it.
---

# Managing the Summary Canvas

Opens or refreshes a reusable **conversation summary canvas** — a side-panel
view that lets a user track and resume work across sessions without
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
- Action Items render with visible "To Do" and "Completed" group labels
- "What Was Built" collapses via `<details>`/`<summary>`
- the Reviewer Matrix renders as a table (including a pending row) above
  "What We Learned"
- both allowed reviewer header pairs render with exactly two verdict columns
- the selected header pair survives durable reload and full-document updates
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

Select the reviewer headers from the primary deliverable:

| Work type | Verdict column 1 | Verdict column 2 |
|---|---|---|
| Writing or editorial (the deliverable is prose/content) | Evidence & Consistency | Readability & Tone |
| Default: code, feature, mixed, ambiguous, or any other work | Safe to Merge | Closes Scope |

This is a closed selection table. Never invent reviewer headers. For a work
type not explicitly listed, use the default pair.

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
  don't duplicate it in the matrix. Keep one flat checklist in the source
  Markdown without hand-written subgroup headings. The canvas automatically
  renders unchecked items under a visible **To Do** label and checked items
  under a visible **Completed** label. When checking an item off, just flip
  its `- [ ]`/`- [x]` marker in place; don't manually regroup the source
  list.
- **What Was Built** — collapsed via `<details>`/`<summary>`, capped at 3-5
  bullets. The PR diff already has full detail; don't duplicate it here.
- **Reviewer Matrix** — placed directly after "What Was Built" and above
  "What We Learned". Always rendered, even before any review has happened.
  Show a "Not yet reviewed" pending state per reviewer/column rather than
  omitting the section. Use exactly two verdict columns after `Reviewer`,
  selected only from the table above:
  - **Safe to Merge** — is the code itself correct and secure (bugs,
    security, lifecycle correctness)?
  - **Closes Scope** — does the work satisfy the full scope of the backing
    issue's action items and requirements?
  - **Evidence & Consistency** — are claims supported and are facts,
    citations, terminology, and internal details consistent?
  - **Readability & Tone** — is the content clear, well structured, and
    appropriate for its audience and intended tone?

  Examples:
  - Code/feature/default:
    `| Reviewer | Safe to Merge | Closes Scope |`
  - Writing/editorial:
    `| Reviewer | Evidence & Consistency | Readability & Tone |`

  Preserve the selected header pair verbatim through refreshes,
  `update_markdown` calls, task-only edits, and checkbox changes. Change it
  only when the work's primary deliverable is explicitly reclassified.

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
3. Decide where the new item goes in the `## Action Items` list. The open
   (unchecked) items are maintained as a **working-order sequence**: the
   user should be able to execute them top-to-bottom without ever being
   blocked by something that appears later. There is no separate dependency
   graph — placement is a plain-meaning judgment made fresh on each insert,
   treating the existing open-item order as correct.

   **How to reason about placement (insertion-sort):**
   Read all currently open (unchecked) items as an ordered execution
   sequence. For the new task, ask two questions:
   - **What does it depend on?** Which existing open items must finish
     before this new task can start? It must go *after* all of those.
   - **What depends on it?** Which existing open items can't start until
     this new task is done? It must go *before* all of those.

   The correct insertion point is the position that satisfies both
   constraints — after everything it depends on, and before everything
   that depends on it. Concretely:
   - If the new task is a **prerequisite for all/most existing items**
     (nothing it depends on is in the list yet), insert it at or near the
     **top** of the open items.
   - If the new task **depends on all/most existing items** (a post-step,
     like a final review or a step that consumes earlier output), insert
     it at or near the **bottom** of the open items.
   - If it depends on some items and blocks others, insert it in the
     **middle** — after the last item it depends on, before the first
     item that depends on it.
   - If placement is **genuinely ambiguous** (not just "could go here or
     there with no consequence," but unclear whether the topmost item
     stays actionable), ask the user rather than guessing.

   **The invariant:** after insertion, the topmost open item must still be
   something the user can start right now, and no open item should be
   silently stuck behind a prerequisite that appears later in the list.
4. Insert as `- [ ] <description>` at the position decided above. Leave
   every other section, and the relative order of every other Action Item,
   untouched.
5. Call `invoke_canvas_action({ instanceId: "<that instance>", actionName: "update_markdown", input: { markdown: "<full markdown with the new item inserted>" } })`.
6. Do not reset checked items, reorder existing items beyond the single
   insertion above, or touch other sections (What Was Built, What We
   Learned, Reviewer Matrix) when doing this — only the Action Items list
   changes, and only by adding the one new line.

Example (top insertion — prerequisite for everything): the open items are
`- [ ] Draft the detailed technical paper`, then
`- [ ] Distill the 1-page summary from the paper`. The user says "add a
task to define the audience and tone guidelines." That determines *how*
to write the paper, so it must happen first — insert at the top:
`- [ ] Define audience and tone guidelines`,
`- [ ] Draft the detailed technical paper`,
`- [ ] Distill the 1-page summary from the paper`.

Example (bottom insertion — depends on earlier work): same list, the user
says "add a task to replace placeholder citations with verified links."
Replacing citations requires the paper to exist first — insert at the
bottom:
`- [ ] Define audience and tone guidelines`,
`- [ ] Draft the detailed technical paper`,
`- [ ] Distill the 1-page summary from the paper`,
`- [ ] Replace placeholder citations with verified links`.

Example (middle insertion): the open items are
`- [ ] Write the deployment doc`,
`- [ ] Deploy to production`,
`- [ ] Send the launch announcement`. The user says "add a task to get
security sign-off." Sign-off depends on having the doc, but must happen
before deploying — insert between those two:
`- [ ] Write the deployment doc`,
`- [ ] Get security sign-off`,
`- [ ] Deploy to production`,
`- [ ] Send the launch announcement`.

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

## Reordering the task list on demand

Trigger: the user explicitly asks to reorder, re-sort, re-prioritize, or
reorganize the Action Items list (e.g. "reorder the tasks", "re-sort the
action items", "fix the task order"). This is **not** done automatically —
only on explicit request.

1. Get the canvas's current full Markdown via `get_state`.
2. Extract all open (unchecked) items from the `## Action Items` section.
   Leave checked-off (done) items untouched — they're already in the
   Completed group and their order doesn't matter for execution.
3. Re-sort the open items into working order: top-to-bottom execution
   sequence where each item can be started once the items above it are
   done. Use the same plain-meaning reasoning as the insertion-sort rule
   in "Adding a single task" — no dependency graph, just read the task
   descriptions and determine a logical execution order.
4. If the correct order of two or more items is genuinely ambiguous, ask
   the user rather than guessing.
5. Rewrite the `## Action Items` section with the re-sorted open items
   (followed by the done items, which the renderer already groups
   separately). Leave every other section untouched.
6. Push the full amended document via `update_markdown`.
