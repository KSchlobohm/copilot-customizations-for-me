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
| Gemini 3.5 Flash (reasoning: minimal) | ⏳ Not yet reviewed | ⏳ Not yet reviewed |
| (Model family unknown) (Version unknown) | ⏳ Not yet reviewed | ⏳ Not yet reviewed |

## What We Learned
Markdown link/image syntax and raw-HTML passthrough are both real XSS surfaces
in a hand-rolled renderer; both need explicit sanitization.
`;

test("header renders with a working linked issue number and title", () => {
    const html = renderMarkdown(SAMPLE_MARKDOWN);
    assert.match(
        html,
        /<a href="https:\/\/github\.com\/octocat\/example-repo\/issues\/42"[^>]*>#42<\/a>/,
        "expected the issue header to render as a working link containing #42"
    );
    assert.match(html, /Reusable conversation summary canvas skill/);
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

test("Reviewer Matrix renders as a table with per-reviewer verdicts, including a pending row", () => {
    const html = renderMarkdown(SAMPLE_MARKDOWN);
    assert.match(html, /<table>/);
    assert.match(html, /Claude Opus 4\.8 \(reasoning: high\)/);
    assert.match(html, /GPT-5\.6 \(reasoning: high\)/);
    assert.match(html, /GPT-5\.6 \(reasoning: xhigh\)/);
    assert.match(html, /Claude Haiku 4\.5/);
    assert.doesNotMatch(html, /Claude Haiku 4\.5 \(reasoning:/);
    assert.match(html, /Gemini 3\.5 Flash \(reasoning: minimal\)/);
    assert.match(html, /\(Model family unknown\) \(Version unknown\)/);
    assert.doesNotMatch(html, /\(Model family unknown\) \(Version unknown\) \(reasoning:/);
    assert.match(html, /Pass with concerns/);
    assert.match(html, /Not yet reviewed/);
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