// Structural verification for the summary canvas: renders a realistic,
// full-shape document through the *actual* renderer (no mocks) and asserts
// the required layout invariants documented in SKILL.md:
//   - header renders with a working linked issue number
//   - Action Items appears directly below the header
//   - "What Was Built" is collapsed via <details>/<summary>
//   - Reviewer Matrix renders (and sits above "What We Learned")
//   - parseActionItems/summarizeActionItems agree with what's on the page
//
// Run with: node --test .github/skills/managing-summary-canvas/extension/verify.test.mjs

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { renderMarkdown } from "./markdown.mjs";
import { summarizeActionItems } from "./tasks.mjs";

const SAMPLE_MARKDOWN = `## [#42](https://github.com/octocat/example-repo/issues/42) — Reusable conversation summary canvas skill
Build a canvas + skill for tracking and resuming work across sessions.

## Action Items
- [x] Scaffold the canvas extension at user scope
- [ ] Add the reviewer matrix section
- [ ] Verify end-to-end with a real summary

<details>
<summary>What Was Built</summary>

- Canvas extension with open/update_markdown/get_state actions
- Hand-rolled Markdown renderer with theme CSS variables
- SKILL.md documenting activation and section conventions
</details>

## Reviewer Matrix

| Reviewer | Safe to Merge | Closes Scope |
|---|---|---|
| Claude Opus 4.8 (reasoning: high) | ✅ Pass | ✅ Pass |
| GPT-5.6 (reasoning: high) | ✅ Pass | ✅ Pass |
| GPT-5.6 (reasoning: xhigh) | ⚠️ Pass with concerns | ✅ Pass |
| Claude Haiku 4.5 | ✅ Pass | ✅ Pass |
| Gemini 3.5 Flash (reasoning: high) | ⏳ Pending | ⏳ Pending |
| (Model family unknown) (Version unknown) | ⏳ Pending | ⏳ Pending |

## What We Learned
Markdown link/image syntax and raw-HTML passthrough are both real XSS surfaces
in a hand-rolled renderer; both need explicit sanitization.
`;

const WRITING_SAMPLE_MARKDOWN = SAMPLE_MARKDOWN
    .replace("| Reviewer | Safe to Merge | Closes Scope |", "| Reviewer | Evidence & Consistency | Readability & Tone |");

const UNLINKED_SAMPLE_MARKDOWN = `# Work Summary: Unlinked Feature Work

> 💡 **Unlinked Summary**: No GitHub Issue is attached to this work. Ask Copilot to create an issue anytime to link it.

Working on unlinked task tracking support.

## Action Items
- [ ] Implement unlinked summary support
`;

const SKILL_MARKDOWN = await readFile(new URL("../SKILL.md", import.meta.url), "utf8");
const SKILL_SCAFFOLD = SKILL_MARKDOWN.match(/```markdown\r?\n([\s\S]*?)\r?\n```/)?.[1] ?? "";

function reviewerHeaders(markdown) {
    const html = renderMarkdown(markdown);
    const header = html.match(/<thead><tr>(.*?)<\/tr><\/thead>/s)?.[1] ?? "";
    return [...header.matchAll(/<th>(.*?)<\/th>/g)].map((match) => match[1]);
}

test("header renders with a working linked issue number and title", () => {
    const html = renderMarkdown(SAMPLE_MARKDOWN);
    assert.match(
        html,
        /<a href="https:\/\/github\.com\/octocat\/example-repo\/issues\/42"[^>]*>#42<\/a>/,
        "expected the issue header to render as a working link containing #42"
    );
    assert.match(html, /Reusable conversation summary canvas skill/);
});

test("unlinked summary header renders title and callout banner correctly", () => {
    const html = renderMarkdown(UNLINKED_SAMPLE_MARKDOWN);
    assert.match(html, /<h1>Work Summary: Unlinked Feature Work<\/h1>/);
    assert.match(html, /<blockquote>/);
    assert.match(html, /Unlinked Summary/);
    assert.match(html, /No GitHub Issue is attached to this work/);
});

test("Action Items section appears directly below the header, before other sections", () => {
    const html = renderMarkdown(SAMPLE_MARKDOWN);
    const headerIdx = html.indexOf("#42");
    const actionItemsIdx = html.indexOf("Action Items");
    const builtIdx = html.indexOf("What Was Built");
    const matrixIdx = html.indexOf("Reviewer Matrix");
    const learnedIdx = html.indexOf("What We Learned");

    assert.ok(headerIdx >= 0 && actionItemsIdx >= 0, "both header and Action Items must render");
    assert.ok(headerIdx < actionItemsIdx, "header must come before Action Items");
    assert.ok(actionItemsIdx < builtIdx, "Action Items must come before What Was Built");
    assert.ok(builtIdx < matrixIdx, "Reviewer Matrix must come after What Was Built");
    assert.ok(matrixIdx < learnedIdx, "Reviewer Matrix must come above What We Learned");
});

test("What Was Built collapses via a sanitized <details>/<summary> block", () => {
    const html = renderMarkdown(SAMPLE_MARKDOWN);
    assert.match(html, /<details>\s*<summary>What Was Built<\/summary>/);
    assert.match(html, /<\/details>/);
});

test("code and feature Reviewer Matrix renders exactly the default two verdict columns", () => {
    const html = renderMarkdown(SAMPLE_MARKDOWN);
    assert.match(html, /<table>/);
    assert.match(html, /Claude Opus 4\.8 \(reasoning: high\)/);
    assert.match(html, /GPT-5\.6 \(reasoning: high\)/);
    assert.match(html, /GPT-5\.6 \(reasoning: xhigh\)/);
    assert.match(html, /Claude Haiku 4\.5/);
    assert.doesNotMatch(html, /Claude Haiku 4\.5 \(reasoning:/);
    assert.match(html, /Gemini 3\.5 Flash \(reasoning: high\)/);
    assert.match(html, /\(Model family unknown\) \(Version unknown\)/);
    assert.doesNotMatch(html, /\(Model family unknown\) \(Version unknown\) \(reasoning:/);
    assert.match(html, /Pass with concerns/);
    assert.match(html, /Pending/);
    assert.deepEqual(reviewerHeaders(SAMPLE_MARKDOWN), ["Reviewer", "Safe to Merge", "Closes Scope"]);
});

test("writing and editorial Reviewer Matrix renders exactly its two verdict columns", () => {
    assert.deepEqual(reviewerHeaders(WRITING_SAMPLE_MARKDOWN), [
        "Reviewer",
        "Evidence &amp; Consistency",
        "Readability &amp; Tone",
    ]);
});

test("skill guidance defines a closed header selection with a fixed default", () => {
    assert.match(SKILL_MARKDOWN, /\| Writing or editorial .* \| Evidence & Consistency \| Readability & Tone \|/);
    assert.match(
        SKILL_MARKDOWN,
        /\| Default: code, feature, mixed, ambiguous, or any other work \| Safe to Merge \| Closes Scope \|/
    );
    assert.match(SKILL_MARKDOWN, /This is a closed selection table\. Never invent reviewer headers\./);
});

test("skill guidance defaults reasoning-capable reviewers to high", () => {
    assert.match(
        SKILL_MARKDOWN,
        /When selecting reviewers, use `high` for every reasoning-capable model/
    );
});

test("skill guidance creates a fresh three-reviewer council only on explicit review requests", () => {
    assert.match(SKILL_MARKDOWN, /"review again" —\s+runs fresh, independent reviewers/);
    assert.match(SKILL_MARKDOWN, /Opening, creating, or refreshing a\s+summary does not start reviewers/);
    assert.match(SKILL_MARKDOWN, /Select three available reviewers from different model families/);
    assert.match(SKILL_MARKDOWN, /Create a new reviewer session for every seat/);
    assert.match(SKILL_MARKDOWN, /Never reuse an existing\s+review or rubber-duck session/);
    assert.match(SKILL_MARKDOWN, /using family, version, and reasoning metadata from these current\s+invocations/);
});

test("skill guidance keeps automatic reviewer configuration near high or medium", () => {
    assert.match(SKILL_MARKDOWN, /use `high`, then `medium` if `high` is unsupported/);
    assert.match(SKILL_MARKDOWN, /Never select `xhigh`,\s+`max`, or `none` automatically/);
});

test("skill guidance runs independent reviews and aggregates high-confidence concerns without repair work", () => {
    assert.match(SKILL_MARKDOWN, /Run all reviewers in parallel with the same complete deliverable/);
    assert.match(SKILL_MARKDOWN, /Do not expose one current reviewer's findings to another before\s+aggregation/);
    assert.match(SKILL_MARKDOWN, /only high-confidence correctness, security,\s+reliability, and scope concerns/);
    assert.match(SKILL_MARKDOWN, /Exclude style, minor nits, and\s+speculative concerns/);
    assert.match(SKILL_MARKDOWN, /merging findings only when they\s+describe the same root cause or affected behavior/);
    assert.match(SKILL_MARKDOWN, /without a fix plan/);
    assert.match(SKILL_MARKDOWN, /decision support for the user/);
    assert.match(SKILL_MARKDOWN, /not an automated merge gate/);
});

test("skill guidance bounds reviewer recovery and preserves blocked or replaced seats", () => {
    assert.match(SKILL_MARKDOWN, /transient execution failure or unusable output, retry that reviewer\s+once/);
    assert.match(SKILL_MARKDOWN, /keep its failed row and add one clearly labeled\s+replacement row/);
    assert.match(SKILL_MARKDOWN, /preferring one not already\s+in the council but allowing a duplicate when necessary/);
    assert.match(SKILL_MARKDOWN, /requested model is\s+unavailable, replace it without the initial retry/);
    assert.match(SKILL_MARKDOWN, /Blocked: required content inaccessible/);
    assert.match(SKILL_MARKDOWN, /Do not substitute another model unless it has\s+confirmed access/);
});

test("skill guidance renews only the current matrix and leaves existing summaries readable", () => {
    assert.match(SKILL_MARKDOWN, /On renewal, replace the current matrix with the fresh roster/);
    assert.match(SKILL_MARKDOWN, /Do not keep a\s+review history in the summary/);
    assert.match(SKILL_MARKDOWN, /verdict changes materially, such as Pass to Fail, mention that change in chat\s+only/);
    assert.match(SKILL_MARKDOWN, /Existing saved summaries remain readable and unchanged/);
});

test("skill guidance uses short unambiguous reviewer labels in Action Items", () => {
    assert.match(SKILL_MARKDOWN, /shortest unambiguous reviewer shorthand/);
    assert.match(SKILL_MARKDOWN, /`- \[x\] \(Opus\)/);
    assert.match(SKILL_MARKDOWN, /`- \[ \] \(GPT-5\.6\)/);
    assert.match(SKILL_MARKDOWN, /matrix\s+is the source of truth for full family, version, and reasoning metadata/);
});

test("skill scaffold does not seed a phantom unknown reviewer", () => {
    assert.doesNotMatch(SKILL_SCAFFOLD, /\(Model family unknown\)/);
    assert.match(SKILL_MARKDOWN, /Add an unknown-metadata row only for an actual reviewer/);
});

test("skill guidance safely rehydrates existing canvases before updating", () => {
    assert.match(SKILL_MARKDOWN, /Reopening an existing `documentId` with no live instance/);
    assert.match(SKILL_MARKDOWN, /omit `markdown` so\s+the extension rehydrates the saved document/);
    assert.match(SKILL_MARKDOWN, /Never send recomposed Markdown before reading the\s+stored state/);
});

test("skill guidance migrates legacy abbreviated reviewer labels without merging verdicts", () => {
    assert.match(SKILL_MARKDOWN, /Migrate a legacy abbreviated label/);
    assert.match(SKILL_MARKDOWN, /use available execution metadata to restore its full\s+identity/);
    assert.match(SKILL_MARKDOWN, /Never merge legacy rows or alter their verdicts during\s+migration/);
});

test("summarizeActionItems agrees with the checkbox states in the rendered document", () => {
    const summary = summarizeActionItems(SAMPLE_MARKDOWN);
    assert.equal(summary.total, 3);
    assert.equal(summary.done, 1);
    assert.equal(summary.remaining, 2);
});

// Bug 1 regression: numbered-checkbox lists (`1. [ ] foo`) must be parsed
// and rendered the same as dash-bulleted ones.
test("numbered-checkbox action items are parsed and counted correctly", () => {
    const numbered = `## Action Items
1. [ ] foo
2. [x] bar
3. [ ] baz`;
    const summary = summarizeActionItems(numbered);
    assert.equal(summary.total, 3);
    assert.equal(summary.done, 1);
    assert.equal(summary.remaining, 2);
    assert.deepEqual(
        summary.items.map((i) => [i.text, i.done]),
        [
            ["foo", false],
            ["bar", true],
            ["baz", false],
        ]
    );
});

test("numbered-checkbox lists render as an <ol> with working checkboxes, not a plain ordered list", () => {
    const numbered = `## Action Items
1. [ ] foo
2. [x] bar`;
    const html = renderMarkdown(numbered);
    assert.match(html, /<ol class="task-list">/);
    assert.match(html, /<input type="checkbox" disabled \/> foo/);
    assert.match(html, /<input type="checkbox" disabled checked \/> bar/);
});

// Feature: Action Items are visually regrouped so open items are separated
// from completed ones, instead of being interleaved in raw document order.
test("Action Items with a mix of open and done items render labeled To Do and Completed groups", () => {
    const mixed = `## Action Items
- [x] first done
- [ ] first open
- [x] second done
- [ ] second open`;
    const html = renderMarkdown(mixed);
    const todoLabelIdx = html.indexOf(">To Do</div>");
    const completedLabelIdx = html.indexOf(">Completed</div>");
    const firstOpenIdx = html.indexOf("first open");
    const secondOpenIdx = html.indexOf("second open");
    const firstDoneIdx = html.indexOf("first done");
    const secondDoneIdx = html.indexOf("second done");

    assert.ok(todoLabelIdx >= 0, "expected a To Do group label");
    assert.ok(completedLabelIdx >= 0, "expected a Completed group label");
    // Both open items follow To Do and precede Completed, preserving their relative order.
    assert.ok(firstOpenIdx > todoLabelIdx && secondOpenIdx < completedLabelIdx);
    assert.ok(firstOpenIdx < secondOpenIdx);
    // Both done items come after Completed, preserving their relative order.
    assert.ok(firstDoneIdx > completedLabelIdx && secondDoneIdx > completedLabelIdx);
    assert.ok(firstDoneIdx < secondDoneIdx);
});

test("Action Items with only one state still render the corresponding group label", () => {
    const allOpen = `## Action Items
- [ ] a
- [ ] b`;
    const allDone = `## Action Items
- [x] a
- [x] b`;
    const openHtml = renderMarkdown(allOpen);
    const doneHtml = renderMarkdown(allDone);
    assert.match(openHtml, />To Do<\/div>/);
    assert.doesNotMatch(openHtml, />Completed<\/div>/);
    assert.match(doneHtml, />Completed<\/div>/);
    assert.doesNotMatch(doneHtml, />To Do<\/div>/);
});

test("grouping is scoped to the Action Items section — a task list elsewhere in the document is unaffected", () => {
    const doc = `## Action Items
- [x] done here
- [ ] open here

## Some Other Section
- [x] done elsewhere
- [ ] open elsewhere`;
    const html = renderMarkdown(doc);
    // The Action Items section still gets a divider (mixed state)...
    const actionItemsSection = html.slice(0, html.indexOf("Some Other Section"));
    assert.match(actionItemsSection, /task-list-section-label/);
    // ...but the raw order is preserved for the unrelated section (no
    // regrouping applied outside "## Action Items").
    const otherSection = html.slice(html.indexOf("Some Other Section"));
    assert.doesNotMatch(otherSection, /task-list-section-label/);
    assert.ok(otherSection.indexOf("done elsewhere") < otherSection.indexOf("open elsewhere"));
});