---
name: managing-summary-canvas
description: Opens, refreshes, adds tasks to, reads state from, and runs a fresh model council for a reusable conversation summary canvas — a side-panel Markdown view with a linked issue header, pinned action items, collapsed build notes, learnings, and a reviewer verdict matrix. Use when the user explicitly asks to open, show, or update the conversation summary canvas; start or renew its model council; review again; manage an action item; or read its current task state.
license: MIT
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
- "start the model council", "renew the model council", or "review again" —
  runs fresh, independent reviewers for the current summary. See "Running a
  model council" below.
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
- the header renders as a working link containing the issue number (for issue-backed) or plain topic title with callout banner (for unlinked)
- Action Items appears directly below the header
- Action Items render with visible "To Do" and "Completed" group labels
- "What Was Built" collapses via `<details>`/`<summary>`
- the Reviewer Matrix renders as a table (including a pending row) above
  "What We Learned"
- both allowed reviewer header pairs render with exactly two verdict columns
- the selected header pair survives durable reload and full-document updates
- `summarizeActionItems` agrees with the checkbox states in the document

### 2. Resolve a `documentId` and backing issue status

Every canvas instance needs a stable `documentId` independent of the panel
(e.g. `issue-42` for linked summaries, or `session-<sessionId>` / `summary-<topic-slug>`
for unlinked summaries) so reopening it, or a second panel on the same document,
shows the same content.

Summaries support both **issue-backed** and **unlinked** modes:
- **Issue-backed summary**: Used when a GitHub Issue link is available. The header links directly to `#<issue-number>`.
- **Unlinked summary**: Used when no GitHub Issue link is available (e.g. local or unlinked workspace, or disabled GitHub Issues). Unlinked summaries render a plain topic title and a persistent callout banner:
  ```markdown
  > 💡 **Unlinked Summary**: No GitHub Issue is attached to this work. Ask Copilot to create an issue anytime to link it.
  ```
- **Transient Chat Nudge**: When initializing or opening an unlinked summary, mention in chat that no issue is attached and that you can create one if requested.
- **In-Place Upgrade**: If the user asks to create an issue for an unlinked summary, create the issue (via `create_issue`), then call `update_markdown` to replace the unlinked banner with `# Work Summary: [#<number> <Title>](<url>)`, preserving all Action Items, Build Notes, Learnings, and Reviewer Matrix.

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

<!-- For unlinked summaries, use this header structure instead: -->
<!-- # Work Summary: <Topic/Session Name> -->
<!-- > 💡 **Unlinked Summary**: No GitHub Issue is attached to this work. Ask Copilot to create an issue anytime to link it. -->
<!-- <one-sentence summary of the work> -->

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
| Claude reviewer (not selected) | ⏳ Pending | ⏳ Pending |
| GPT reviewer (not selected) | ⏳ Pending | ⏳ Pending |
| Gemini reviewer (not selected) | ⏳ Pending | ⏳ Pending |

## What We Learned
<insights / gotchas discovered during the work that aren't in the PR>
```

Rules:
- **Header** — For linked summaries: issue number linked to the GitHub issue URL, issue title, one
  sentence of context. For unlinked summaries: `# Work Summary: <Topic>` header followed by
  `> 💡 **Unlinked Summary**: No GitHub Issue is attached to this work. Ask Copilot to create an issue anytime to link it.`
  and one sentence of context. Always first.
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
  Show a pending state per reviewer/column rather than
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

  Fill each cell with only a status: ⏳ Pending / ✅ Pass / ❌ Fail /
  ⚠️ Pass with concerns / 🚫 Unavailable /
  ⛔ Blocked: required content inaccessible. The matrix shows council
  coverage and review verdicts, not failed execution attempts. It should
  stay scannable at a glance with no per-reviewer comment column.

  Any actual finding, concern, or comment a reviewer raises goes into
  **Action Items** as its own line attributed with the shortest unambiguous
  reviewer shorthand, e.g.:
  `- [x] (Opus) Fixed a URL-scheme allow-list bypass via a
  leading C0 control character before \`javascript:\` — sanitized and
  regression-tested.`
  `- [ ] (GPT-5.6) Missing \`name\` param in the \`install_extension\`
  example would install under the wrong folder.`
  Prefer familiar labels such as `Opus`, `Gemini`, or `GPT-5.6`; the matrix
  is the source of truth for full family, version, and reasoning metadata.
  If two matrix rows would share a shorthand, add only enough detail to make
  the Action Item attribution unambiguous.
  Leave the item unchecked while it still needs a decision before merge.
  Check it once it is disposed for this work: fixed, deferred, accepted, or
  explicitly not planned. Preserve every Action Item and its checkbox state
  across council renewals. This way the matrix shows the current council
  verdicts while Action Items remain the fast, durable view of what is still
  open.
  Before the first council starts, the scaffold's three `(not selected)`
  labels are placeholders, not reviewer identities. Preserve them exactly
  during ordinary refreshes. When the council starts or renews, replace the
  complete matrix with the selected roster from the current invocations.
  After a council starts, reviewer identity in the first column must preserve
  model details:
  - Use the full available family + version followed by the exact reasoning
    depth as `<family> <version> (reasoning: <depth>)` when metadata is known
    (for example `Claude Opus 4.8 (reasoning: high)`,
    `GPT-5.6 (reasoning: high)`, or
    `Gemini 3.5 Flash (reasoning: high)`).
  - When selecting reviewers, use `high` for every reasoning-capable model
    unless the user explicitly requests another supported depth. Once a
    review runs, label it with the exact depth actually selected.
  - If any part is missing, represent it explicitly in the label rather than
    dropping it: `<family> (Version unknown) (reasoning: high)`,
    `(Model family unknown) <version> (reasoning: high)`, or
    `(Model family unknown) (Version unknown)`.
    Add an unknown-metadata row only for an actual reviewer whose metadata is
    unavailable; do not use unknown metadata as a pre-council placeholder.
  - Preserve the reported reasoning-depth value exactly; do not infer,
    translate, or normalize it. Append the reasoning suffix only when
    reasoning depth is a property supported by that model. For a
    reasoning-capable model, use `(reasoning: unknown)` when its selected
    depth is unavailable. For a model that does not expose reasoning depth,
    or when reasoning capability itself is unavailable, omit the suffix
    entirely (for example `Claude Haiku 4.5`).
  - Never collapse or normalize distinct versions or reasoning depths into
    one row (`GPT-5.x`, `Gemini`, `Claude Opus`, etc.). `GPT-5.6
    (reasoning: high)` and `GPT-5.6 (reasoning: xhigh)` remain separate
    reviewer identities with separate verdicts.
  - On refresh/resume, call `get_state` before rewriting matrix rows and
    preserve every reviewer label and verdict exactly as stored. Do not infer
    or migrate placeholder or abbreviated labels. Only an explicit council
    start or renewal replaces the entire matrix with current reviewer
    identities and verdicts.
  - Identity formatting does not alter verdict semantics. Keep verdict values
    exactly the same statuses (`✅ Pass`, `❌ Fail`, `⚠️ Pass with concerns`,
    `⏳ Pending`) regardless of whether model metadata is complete.

- **What We Learned** — last section. New insights/gotchas not captured
  elsewhere.

### Running a model council

A model council is decision support for the user. It assesses the work and
reports verdicts and concerns; it does not plan or implement repairs.

Start one only when the user explicitly asks to start the council for the
first time, renew it, or review again. Opening, creating, or refreshing a
summary does not start reviewers. "Review again" always means a fresh
council.

#### Model discovery (best-effort)

Before selecting reviewers, run `copilot --model auto -p "List exact model invocation IDs available for sub-agents, with family, version, and reasoning levels; mark unknowns and do not guess."`
Use only exact IDs from the advisory response; if it fails, use exact model IDs
surfaced by the current `task` tool/runtime choices or ask the user; never
hardcode.
Select three models with no duplicate model IDs within the current council
roster, from distinct reported families, preferring `high`, then `medium`,
reasoning. Exclude models used by the previous council only when explicitly
requested. Preserve unknown metadata, and replace a failed launch from the
remaining choices without retrying it first.

1. Select three available reviewers from the discovered choices, using the
   rules above. If fewer than three distinct families are reported, stop rather
   than silently duplicating a family.
2. Create a new reviewer session for every seat. Never reuse an existing
   review or rubber-duck session as a current council member. Add the complete
   selected roster to the matrix as `⏳ Pending` before starting reviews,
   using the discovered metadata and marking it as requested/model-reported
   metadata until the runtime reports effective values. Use one separate `task`
   call per seat and launch all three calls together in one
   `multi_tool_use.parallel` invocation. Do not reuse an existing `agent_id`
   through `write_agent`.
3. Run all reviewers in parallel with the same complete deliverable and
   relevant context. Each reviewer independently returns both matrix
   verdicts. Do not expose one current reviewer's findings to another before
   aggregation.
4. Ask reviewers to report only high-confidence correctness, security,
   reliability, and scope concerns. Exclude style, minor nits, and
   speculative concerns. A verdict is `✅ Pass` with no actionable concerns,
   `⚠️ Pass with concerns` with only non-blocking actionable concerns, and
   `❌ Fail` with any blocking concern.
5. Keep a seat `⏳ Pending` while recovering from an execution failure. For
   a transient failure or unusable output, retry the same ID once. If an ID
   fails to start, replace it from the remaining discovered choices without
   retrying that failed-to-start ID.
   Update the seat when replacement succeeds; retry that replacement once. If
   it still fails, mark the seat `🚫 Unavailable`, leave the council incomplete,
   and report the failure and replacement in chat.
6. If required content is inaccessible, let other reviewers finish, mark the
   affected seat `⛔ Blocked: required content inaccessible`, and leave the
   council incomplete. Do not substitute another model unless it has
   confirmed access to the missing content. Explain the unavailable scope in
   chat; an incomplete council cannot provide a full merge-ready verdict.
7. Aggregate only after every seat reaches a terminal state. Surface every
   actionable concern in Action Items, merging findings only when they
   describe the same root cause or affected behavior. Order shared concerns
   first, then by blocking severity and security impact. Each item states the
   problem, impact, affected location when known, and all agreeing reviewers,
   without a fix plan.

The council is complete only when all three seats have review verdicts. For a
complete council, any `❌ Fail` means not ready; otherwise any
`⚠️ Pass with concerns` means ready with concerns; all `✅ Pass` means ready.
This result supports the user's decision and is not an automated merge gate.

On renewal, replace only the current matrix with the fresh roster. Do not
keep previous matrices or verdicts. Preserve all Action Items and their
checkbox states; renewal never deletes, resets, or completes them. Do not
claim that a review maps to a commit or exact code version. The user decides
when earlier results are stale. If a verdict changes materially, such as Pass
to Fail, mention that change in chat only. Existing saved summaries remain
readable and unchanged until the user starts or renews their council.

### 4. Open or refresh

- **First time for this `documentId`:**
  `open_canvas({ canvasId: "conversation-summary-canvas", instanceId: "<pick-one>", input: { documentId, title: "<issue title>", markdown } })`
- **Reopening an existing `documentId` with no live instance:**
  call `open_canvas` with `documentId` and `title` only — omit `markdown` so
  the extension rehydrates the saved document — then call `get_state` before
  composing any update. Never send recomposed Markdown before reading the
  stored state.
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
