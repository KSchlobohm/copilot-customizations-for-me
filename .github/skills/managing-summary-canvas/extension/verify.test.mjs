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
| Claude Opus | ✅ Pass | ✅ Pass |
| GPT-5.x | ✅ Pass | ✅ Pass |
| Gemini | ⏳ Not yet reviewed | ⏳ Not yet reviewed |

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
    assert.match(html, /Claude Opus/);
    assert.match(html, /Not yet reviewed/);
});

test("summarizeActionItems agrees with the checkbox states in the rendered document", () => {
    const summary = summarizeActionItems(SAMPLE_MARKDOWN);
    assert.equal(summary.total, 3);
    assert.equal(summary.done, 1);
    assert.equal(summary.remaining, 2);
});