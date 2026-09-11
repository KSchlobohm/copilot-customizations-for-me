---
name: managing-summary-canvas
description: Opens, refreshes, and manages a reusable conversation summary canvas with action items and a reviewer matrix. Runs three fresh perspective-owned reviews contributing to one combined recommendation, with preferred models including repeated models. Use when the user explicitly asks to open, show, or update the summary canvas; run or rerun the reviewer matrix; start or renew its model council; review again; manage an action item; or read its current task state.
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
- "run the reviewer matrix", "rerun the reviewer matrix",
  "start the model council", "renew the model council", or "review again" —
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
Showing or updating the reviewer matrix never starts reviewers. A refresh
resets legacy review sections for reassessment; see "Refresh and renewal".

## Underlying mechanism

The canvas is implemented by the `conversation-summary-canvas` extension
committed alongside this skill at `.github/skills/managing-summary-canvas/extension/`.
It is a **generic Markdown renderer** with two actions, `update_markdown`
(write) and `get_state` (read) — it does not enforce section structure
itself. This skill is what enforces the structure, by controlling the
Markdown you generate before calling `open_canvas` / `invoke_canvas_action`.

### 1. Ensure the extension is installed (user scope)

Check `extensions_manage({ operation: "list" })` for `conversation-summary-canvas`.
If absent, install this repo's extension folder at **user scope** for reuse
across sessions. Always pass the `name` override: otherwise `install_extension`
uses the URL's last segment (`extension`), producing the wrong folder/extensionId.

```
install_extension({
  url: "https://github.com/<owner>/<repo>/tree/<ref>/.github/skills/managing-summary-canvas/extension",
  scope: "user",
  name: "conversation-summary-canvas"
})
```

Then call `extensions_reload` if it wasn't picked up automatically.

**Verification.** After changing these conventions or `markdown.mjs`, run
`node --test .github/skills/managing-summary-canvas/extension/verify.test.mjs`.
It uses the real renderer and documented scaffolds to check:
- linked/unlinked headers, pinned Action Items with To Do/Completed groups, and collapsed build notes
- both profiles show three named perspectives and owned questions before review
- the Reviewer Matrix has one assessment column and one combined recommendation
- model metadata renders separately in a collapsed "Review preferences" block
- `summarizeActionItems` agrees with the checkbox states in the document
Run `extension/store.test.mjs` for exact persistence of questions, results,
preferences, and task states. Guidance assertions check the skill contract,
not live reviewer orchestration. Updating this skill, not reloading the
generic renderer, changes how future summaries are authored.

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

Select the profile and tailor its questions before composing even a pending table.
Follow [Deliverable-specific perspectives](#deliverable-specific-perspectives)
for mixed work; it is not automatically code work. Both profiles use exactly
`Perspective | Question it owns | Assessment`. Each perspective owns a different
question, not a parallel overall judgment. The code scaffold is:

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

| Perspective | Question it owns | Assessment |
|---|---|---|
| Intent | Does the change deliver the agreed outcome and scope? | ⏳ Pending |
| Failure | Could changed behavior fail or permit unintended execution? | ⏳ Pending |
| Maintenance | Is the change understandable, consistent, and safe to maintain? | ⏳ Pending |

**Combined recommendation:** ⏳ Pending — review has not started.

## What We Learned
<insights / gotchas discovered during the work that aren't in the PR>
```

Rules:
- **Header** — always first: linked issue number/title or the unlinked topic
  and banner from step 2, followed by one sentence of context.
- **Action Items** — pinned below the header; real actionable items, including
  reviewer findings. Keep one flat checklist without subgroup headings. The
  renderer groups unchecked items under **To Do** and checked items under
  **Completed**. Flip `- [ ]`/`- [x]` in place; don't regroup the source list.
- **What Was Built** — collapsed via `<details>`/`<summary>`, 3-5 bullets.
  Do not duplicate the PR diff.
- **Reviewer Matrix** — placed directly after "What Was Built" and above
  "What We Learned". Show exactly three named perspective rows before models
  are selected. Never use unnamed placeholders, append model names to
  perspectives, or collapse rows when models repeat.
  Fill each Assessment cell with only a status: ⏳ Pending / ✅ Pass / ❌ Fail /
  ⚠️ Pass with concerns / 🚫 Unavailable /
  ⛔ Blocked: required content inaccessible. Do not add verdict or comment
  columns. Below the table, show exactly one **Combined recommendation** with
  a short rationale. Only when preferences have been resolved, follow it
  with a collapsed "Review preferences" block for selected preferences and
  current-run metadata, not model details in the table.
- **Review findings** — put every actionable concern in **Action Items**,
  attributed by perspective, e.g.:
  `- [x] (Failure) Fixed a URL-scheme allow-list bypass — regression-tested.`
  `- [ ] (Intent, Maintenance) Missing \`name\` param in the \`install_extension\`
  example would install under the wrong folder.`
  Preserve historical attribution on existing items during renewals. Leave
  an item unchecked while it needs a decision for this work.
  Check it once it is disposed for this work: fixed, deferred, accepted, or
  explicitly not planned. Renewal never disposes items automatically.
- **What We Learned** — last section. New insights/gotchas not captured
  elsewhere.

### Running a model council

A model council is decision support for the user: complementary assessments
and one combined recommendation, not planning or implementing repairs.

Start one only when the user explicitly asks to start the council for the
first time, renew it, or review again. Opening, creating, or refreshing a
summary does not start reviewers. "Review again" always means a fresh
council.

#### Deliverable-specific perspectives

Read existing state with `get_state` before selecting the profile.
**Code** covers non-writing deliverables: Intent owns outcomes/scope, Failure
owns correctness/reliability/unsafe behavior, and Maintenance owns clarity,
consistency, and safe future changes. **Writing** covers prose/content; replace
the scaffold's table with this one and tailor its questions:

```markdown
| Perspective | Question it owns | Assessment |
|---|---|---|
| Purpose & Audience | Does the content meet its readers' needs and intended purpose? | ⏳ Pending |
| Evidence & Consistency | Are its claims supported and its details internally consistent? | ⏳ Pending |
| Style & Tone | Are its structure, clarity, and voice appropriate for the audience? | ⏳ Pending |
```

For mixed work, use the primary outcome and assign supporting-deliverable coverage
in the prompts. If classification or coverage is materially ambiguous, ask one
focused question before composing or launching; do not invent a third profile.
Retain the selected profile and owned questions on reruns unless the deliverable
changes or the user overrides them. Question wording should identify this
deliverable's scope, not repeat generic examples.

Perspectives are primary assignments, not blinders: flag obvious outside-focus
blockers separately. Each reviewer assesses only its owned question; outside-focus
blockers affect synthesis without redefining it. Style and tone are
substantive scope for writing, not excluded as code-style nits.

#### Model preferences (per summary)

The user's default `gpt-6-astra-medium` means model ID `gpt-6-astra` with
`reasoning_effort: "medium"`, not a `-medium` model suffix. Use this default for all three seats.
Repeated model IDs and families are allowed, including three identical selections.

Selection order: explicit user override, saved per-summary preferences, then
the default above. Overrides are remembered for that summary, not globally.
If the user overrides a model without specifying reasoning, use the runtime
default for that model rather than transferring another model's reasoning level.
Validate IDs and supported reasoning levels against current runtime/tool choices;
do not invoke a nested CLI to guess availability. If a selection is unavailable
or ambiguous, ask the user rather than silently choosing another model or depth.
Do not pass historical markers such as `runtime-default` as literal model IDs
or silently replace them with the shared default; resolve the choice with the
user before launching.

Persist the profile and three preferences in the Reviewer Matrix's collapsed
"Review preferences" block before launching:

````markdown
<details>
<summary>Review preferences</summary>

```json
{"profile":"code","seats":[{"perspective":"Intent","model":"gpt-6-astra","reasoning_effort":"medium"},{"perspective":"Failure","model":"gpt-6-astra","reasoning_effort":"medium"},{"perspective":"Maintenance","model":"gpt-6-astra","reasoning_effort":"medium"}]}
```

Current run: not started.
</details>
````

Use `"writing"` for the writing profile and its exact perspective names. Omit
`reasoning_effort` when using the runtime default. On profile changes, retain
model preferences by seat number unless the user overrides them. Read this
block on resume; preserve selected preferences through refreshes, task edits,
and renewals, separately from current-run metadata.
If it is malformed or conflicts with the three-seat profile, ask rather than
discarding preferences. If preferences are absent, use explicit choices or
the default, never guessed preferences from historical reviewer labels.

Replace "Current run: not started" with one line per perspective when a run
starts, recording **requested** model/version/reasoning separately from
**effective** runtime-confirmed metadata. Unknown family/version/reasoning
stays unknown; omit reasoning when unsupported or its capability is unknown.
Never present requested settings as independently verified effective settings.
A preference-only change leaves current results and their run metadata intact.

#### Run and aggregate

1. Resolve perspectives, owned questions, and validated model preferences.
   Reset the three assessments and combined recommendation to `⏳ Pending`;
   replace current-run metadata, not selected preferences. Save the full
   document via `update_markdown` (or first `open_canvas`) before launching.
   A preference-only change never starts reviews or rewrites existing results.
2. Create a new reviewer session for every seat. Never reuse an existing
   review or rubber-duck session as a current council member. Use one separate
   `task` call per seat and launch all three calls together in one
   `multi_tool_use.parallel` invocation. Do not reuse an existing `agent_id`
   through `write_agent`. Pass each seat's selected `model` and, when specified,
   `reasoning_effort` to its `task` call.
3. Run all reviewers in parallel with the same complete deliverable and
   relevant context, plus its assigned perspective and exact owned question.
   Request read-only review, not implementation, using the result contract below.
   Do not expose one current reviewer's findings to another before
   aggregation.
4. Ask reviewers to report only high-confidence, actionable concerns relevant
   to the deliverable and explain their concrete impact. Exclude code-style
   preferences, minor nits, and speculative concerns, not writing-style issues
   that affect the intended reader. Assess the owned question as `✅ Pass`
   with no actionable concerns, `⚠️ Pass with concerns` with only non-blocking
   actionable concerns, or `❌ Fail` with a blocking concern in that scope.
5. Keep a seat `⏳ Pending` while recovering from an execution failure. For
   a transient failure or unusable output, retry the same selection once.
   If it cannot start or the retry fails, mark the seat `🚫 Unavailable`,
   leave the council incomplete, and report the execution failure in chat.
   Ask before substituting a model or reasoning depth. Any approved replacement
   retains the seat's perspective; do not retain failed-attempt rows in the matrix.
6. If required content is inaccessible, let other reviewers finish, mark the
   affected seat `⛔ Blocked: required content inaccessible`, and leave the
   council incomplete. Do not substitute another model unless it has
   confirmed access to the missing content. Explain the unavailable scope in
   chat; an incomplete council cannot provide a ready recommendation.
7. Aggregate only after every seat reaches a terminal state. Surface every
   actionable concern in Action Items, merging findings only when they
   describe the same root cause or affected behavior. Order shared concerns
   first, then by blocking severity and security impact. Each item states the
   problem, impact, affected location when known, and all agreeing perspectives,
   without a fix plan.

#### Reviewer result contract

Include this contract in every reviewer prompt, filling in its perspective and question:

```text
Perspective: <assigned perspective>
Question: <exact owned question>
Assessment: <✅ Pass / ⚠️ Pass with concerns / ❌ Fail / ⛔ Blocked: required content inaccessible>
Rationale: <brief evidence supporting that assessment>
Findings: <actionable concerns in this scope, or None; each gives problem,
           impact, location when known, and blocking/non-blocking severity>
Cross-cutting blockers: <obvious blockers outside this scope, or None;
                        each gives problem, impact, and location when known>
```

Do not request a merge vote, answers to other perspectives' questions, or a
combined recommendation from an individual reviewer. Missing required fields,
mismatched perspective/question, invalid status, or contradictory assessment/findings
are unusable output; apply the retry rule rather than inferring a Pass.
Keep rationale in synthesis, not a new column; effective metadata needs runtime evidence.

#### Combined recommendation

The coordinating agent writes one recommendation with a brief deliverable-specific
rationale. Synthesize evidence and concerns, not majority votes or model rankings.
Apply these rules in order:

| Condition | Combined recommendation |
|---|---|
| Reviews have not started or any seat is still running | ⏳ Pending |
| All seats terminal, but any is Unavailable or Blocked | 🚫 Incomplete |
| Complete coverage, with any Fail or unresolved blocking concern | ❌ Not ready |
| Complete coverage, with any Pass with concerns or unresolved non-blocking review concern | ⚠️ Ready with concerns |
| Complete coverage, all Pass, and no unresolved review concerns | ✅ Ready |

Complete coverage means all three perspectives have usable assessments.
Always surface known blockers and missing coverage in the rationale, including
while Pending or Incomplete. A cross-cutting blocker prevents Ready even if
all owned questions pass. Reconcile known unresolved blocking Action Items;
do not ignore them merely because a fresh reviewer omitted them. Ordinary open
tasks are not automatically review blockers. Never automatically dispose items.

Independent sessions are not evidence of model diversity when models repeat.
This result supports the user's decision and is not an automated merge gate
or permission to publish.

#### Refresh and renewal

Call `get_state` before rewriting an existing summary. On a full-summary or
matrix refresh, replace any legacy review section with the new contract and
reset assessments and the combined recommendation to Pending. Discard old
votes and current-run claims rather than translating or preserving old council
behavior. Preserve Action Items, checkbox states, historical attribution,
selected model preferences, and other sections. Report the reset in chat;
do not start reviewers. There is no legacy-layout compatibility path.

For a section already following this contract, ordinary refreshes preserve
its profile, questions, assessments, combined recommendation, and run metadata.
Reopening only rehydrates saved content. Task-only edits leave the entire
review section untouched.

On explicit renewal, replace current results and run metadata with a fresh
review; keep the profile/questions unless scope or user choice changes.
Do not keep previous matrices or recommendations. Preserve all Action Items
and their checkbox states; renewal never deletes, resets, or completes them.
Do not claim reviews map to an exact commit/version. The user decides when
current-format results are stale. Mention material assessment changes in chat.

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

Send full Markdown each time; `update_markdown` replaces the whole document.

## Adding a single task

Trigger: "add a task for <description>", "add an action item for...", or
"track a task to...". This updates one Action Item, not other sections.

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

Trigger: questions about current canvas state, e.g. "how many tasks are left?",
"what's still open?", or "close off <task>" / "check off <task>" (complete an
existing item, not add one). Read live state, not conversation memory.

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

Trigger: explicit requests to reorder, re-sort, re-prioritize, or reorganize
Action Items. Never reorder automatically.

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
