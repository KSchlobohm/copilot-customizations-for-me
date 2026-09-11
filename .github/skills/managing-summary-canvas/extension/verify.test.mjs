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
const scaffoldStart = SKILL_MARKDOWN.indexOf("## Reviewer Matrix");
const scaffoldEnd = SKILL_MARKDOWN.indexOf("## What We Learned", scaffoldStart);
const SKILL_SCAFFOLD = scaffoldStart >= 0 && scaffoldEnd > scaffoldStart
    ? SKILL_MARKDOWN.slice(scaffoldStart, scaffoldEnd)
    : "";

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

test("three perspectives render as separate rows with the same model for both deliverables", () => {
    const profiles = [
        { perspectives: ["Intent", "Failure", "Maintenance"], headers: ["Safe to Merge", "Closes Scope"] },
        { perspectives: ["Purpose & Audience", "Evidence & Consistency", "Style & Tone"], headers: ["Evidence & Consistency", "Readability & Tone"] },
    ];
    for (const { perspectives, headers } of profiles) {
        const markdown = `## Reviewer Matrix\n\n| Reviewer | ${headers.join(" | ")} |\n|---|---|---|\n`
            + perspectives.map((perspective) =>
                `| ${perspective} — GPT-6 Astra (reasoning: medium) | ⏳ Pending | ⏳ Pending |`
            ).join("\n");
        const html = renderMarkdown(markdown);
        const rows = html.match(/<tbody>(.*?)<\/tbody>/s)?.[1] ?? "";
        assert.equal([...rows.matchAll(/<tr>/g)].length, 3);
        assert.equal([...rows.matchAll(/GPT-6 Astra \(reasoning: medium\)/g)].length, 3);
        for (const perspective of perspectives) {
            assert.ok(rows.includes(perspective.replaceAll("&", "&amp;")));
        }
        assert.equal(reviewerHeaders(markdown).length, 3);
    }
});

test("the documented preferences block has three default seats and renders collapsed", () => {
    const block = SKILL_MARKDOWN.match(/<details>\s*<summary>Review preferences<\/summary>[\s\S]*?<\/details>/)?.[0];
    assert.ok(block, "expected an inspectable preferences block in the skill");
    const preferences = JSON.parse(block.match(/```json\s+([\s\S]*?)\s+```/)[1]);
    assert.equal(preferences.profile, "code");
    assert.deepEqual(preferences.seats, ["Intent", "Failure", "Maintenance"].map((perspective) => ({
        perspective, model: "gpt-6-astra", reasoning_effort: "medium",
    })));
    const html = renderMarkdown(block);
    assert.match(html, /<details>\s*<summary>Review preferences<\/summary>/);
    assert.match(html, /<pre><code class="language-json">/);
    assert.doesNotMatch(html, /<details open/);
});

test("skill guidance defines a closed header selection with a fixed default", () => {
    assert.match(SKILL_MARKDOWN, /\| Writing or editorial .* \| Evidence & Consistency \| Readability & Tone \|/);
    assert.match(
        SKILL_MARKDOWN,
        /\| Default: code, feature, mixed, ambiguous, or any other work \| Safe to Merge \| Closes Scope \|/
    );
    assert.match(SKILL_MARKDOWN, /This is a closed selection table\. Never invent reviewer headers\./);
});

test("skill guidance uses the user's exact default and allows repeated models", () => {
    assert.match(SKILL_MARKDOWN, /model ID `gpt-6-astra` with\s+`reasoning_effort: "medium"`/);
    assert.match(SKILL_MARKDOWN, /Use this default for all three seats/);
    assert.match(SKILL_MARKDOWN, /Repeated model IDs and families are\s+allowed/);
    assert.doesNotMatch(SKILL_MARKDOWN, /no duplicate model IDs|three distinct families|default.*reviewers to high/);
});

test("skill guidance creates a fresh three-reviewer council only on explicit review requests", () => {
    assert.match(SKILL_MARKDOWN, /"review again" —\s+runs fresh, independent reviewers/);
    assert.match(SKILL_MARKDOWN, /"run the reviewer matrix", "rerun the reviewer matrix"/);
    assert.match(SKILL_MARKDOWN, /Opening, creating, or refreshing a\s+summary does not start reviewers/);
    assert.match(SKILL_MARKDOWN, /Showing or updating the reviewer matrix refreshes existing results only;\s+it never starts reviewers/);
    assert.match(SKILL_MARKDOWN, /Create a new reviewer session for every seat/);
    assert.match(SKILL_MARKDOWN, /Never reuse an existing\s+review or rubber-duck session/);
    assert.match(SKILL_MARKDOWN, /Use one separate\s+`task` call per seat and launch all three calls together in one\s+`multi_tool_use\.parallel` invocation/);
    assert.match(SKILL_MARKDOWN, /Do not reuse an existing `agent_id`\s+through `write_agent`/);
});

test("skill guidance remembers per-summary choices and does not silently substitute models", () => {
    assert.match(SKILL_MARKDOWN, /Selection order: explicit user override, saved per-summary preferences, then\s+the default above/);
    assert.match(SKILL_MARKDOWN, /remembered for that summary, not globally/);
    assert.match(SKILL_MARKDOWN, /Read this\s+block on resume; preserve it through refreshes, task edits, and renewals/);
    assert.match(SKILL_MARKDOWN, /malformed or conflicts with the three-seat profile, ask/);
    assert.match(SKILL_MARKDOWN, /If a selection is unavailable\s+or ambiguous, ask the user/);
    assert.match(SKILL_MARKDOWN, /runtime\s+default for that model rather than transferring another model's reasoning level/);
    assert.match(SKILL_MARKDOWN, /retain\s+model preferences by seat number/);
    assert.match(SKILL_MARKDOWN, /Older summaries without it remain unchanged until an\s+explicit review run/);
    assert.doesNotMatch(SKILL_MARKDOWN, /copilot --model auto/);
});

test("skill guidance assigns deliverable-specific perspectives without excluding writing style", () => {
    assert.match(SKILL_MARKDOWN, /\| Code \| Intent:.*\| Failure:.*\| Maintenance:/);
    assert.match(SKILL_MARKDOWN, /\| Writing \| Purpose & Audience:.*\| Evidence & Consistency:.*\| Style & Tone:/);
    assert.match(SKILL_MARKDOWN, /classification or coverage\s+is materially ambiguous, ask one focused question/);
    assert.match(SKILL_MARKDOWN, /Every reviewer still evaluates\s+both verdict columns/);
    assert.match(SKILL_MARKDOWN, /Style and tone are\s+substantive scope for writing/);
    assert.match(SKILL_MARKDOWN, /Perspectives are primary assignments, not blinders/);
});

test("skill guidance runs independent reviews and aggregates high-confidence concerns without repair work", () => {
    assert.match(SKILL_MARKDOWN, /Run all reviewers in parallel with the same complete deliverable/);
    assert.match(SKILL_MARKDOWN, /Do not expose one current reviewer's findings to another before\s+aggregation/);
    assert.match(SKILL_MARKDOWN, /only high-confidence, actionable concerns relevant\s+to the deliverable/);
    assert.match(SKILL_MARKDOWN, /not writing-style issues\s+that affect the intended reader/);
    assert.match(SKILL_MARKDOWN, /Request read-only review, not implementation/);
    assert.match(SKILL_MARKDOWN, /merging findings only when they\s+describe the same root cause or affected behavior/);
    assert.match(SKILL_MARKDOWN, /without a fix plan/);
    assert.match(SKILL_MARKDOWN, /decision support for the user/);
    assert.match(SKILL_MARKDOWN, /not an automated merge gate/);
});

test("skill guidance keeps execution attempts out of the matrix while preserving council coverage", () => {
    assert.match(SKILL_MARKDOWN, /Keep a seat `⏳ Pending` while recovering from an execution failure/);
    assert.match(SKILL_MARKDOWN, /transient failure or unusable output, retry the same selection once/);
    assert.match(SKILL_MARKDOWN, /Ask before substituting a model or reasoning depth/);
    assert.match(SKILL_MARKDOWN, /replacement\s+retains the seat's perspective/);
    assert.match(SKILL_MARKDOWN, /do not retain failed-attempt rows in the matrix/);
    assert.match(SKILL_MARKDOWN, /mark the seat\s+`🚫 Unavailable`,\s+leave the council incomplete/);
    assert.match(SKILL_MARKDOWN, /report the execution failure in chat/);
    assert.doesNotMatch(SKILL_MARKDOWN, /Invocation failed/);
    assert.match(SKILL_MARKDOWN, /Blocked: required content inaccessible/);
    assert.match(SKILL_MARKDOWN, /Do not substitute another model unless it has\s+confirmed access/);
});

test("Reviewer Matrix renders an unavailable seat distinctly from review verdicts", () => {
    const markdown = `## Reviewer Matrix
| Reviewer | Safe to Merge | Closes Scope |
|---|---|---|
| GPT-5.6 (reasoning: high) | 🚫 Unavailable | 🚫 Unavailable |
| Claude Sonnet 5 (reasoning: high) | ✅ Pass | ✅ Pass |`;
    const html = renderMarkdown(markdown);
    assert.match(html, /🚫 Unavailable/);
    assert.match(html, /✅ Pass/);
    assert.doesNotMatch(html, /Invocation failed/);
});

test("skill guidance renews verdicts without changing durable Action Items", () => {
    assert.match(SKILL_MARKDOWN, /On renewal, replace only the current matrix with the fresh roster/);
    assert.match(SKILL_MARKDOWN, /Do not\s+keep previous matrices or verdicts/);
    assert.match(SKILL_MARKDOWN, /Preserve all Action Items and their\s+checkbox states/);
    assert.match(SKILL_MARKDOWN, /renewal never deletes, resets, or completes them/);
    assert.match(SKILL_MARKDOWN, /fixed, deferred, accepted, or\s+explicitly not planned/);
    assert.match(SKILL_MARKDOWN, /verdict changes materially, such as Pass\s+to Fail, mention that change in chat\s+only/);
    assert.match(SKILL_MARKDOWN, /Existing saved summaries remain\s+readable and unchanged/);
});

test("skill guidance attributes Action Items by perspective when models repeat", () => {
    assert.match(SKILL_MARKDOWN, /attributed by perspective/);
    assert.match(SKILL_MARKDOWN, /`- \[x\] \(Failure\)/);
    assert.match(SKILL_MARKDOWN, /`- \[ \] \(Intent, Maintenance\)/);
    assert.match(SKILL_MARKDOWN, /Preserve historical attribution on existing items/);
});

test("skill scaffold does not seed a phantom unknown reviewer", () => {
    assert.doesNotMatch(SKILL_SCAFFOLD, /\(Model family unknown\)/);
    for (const seat of [1, 2, 3]) {
        assert.ok(SKILL_SCAFFOLD.includes(`Reviewer ${seat} (not selected)`));
    }
    assert.doesNotMatch(SKILL_SCAFFOLD, /<selected reviewer/);
    assert.match(SKILL_MARKDOWN, /Add an unknown-metadata row\s+only for an actual reviewer/);
});

test("skill guidance safely rehydrates existing canvases before updating", () => {
    assert.match(SKILL_MARKDOWN, /Reopening an existing `documentId` with no live instance/);
    assert.match(SKILL_MARKDOWN, /omit `markdown` so\s+the extension rehydrates the saved document/);
    assert.match(SKILL_MARKDOWN, /Never send recomposed Markdown before reading the\s+stored state/);
});

test("skill guidance preserves pre-council placeholders until explicit council activation", () => {
    assert.match(SKILL_MARKDOWN, /Before the first council starts, the scaffold's three `\(not selected\)`\s+labels are placeholders/);
    assert.match(SKILL_MARKDOWN, /preserve every reviewer label and verdict exactly as stored/);
    assert.match(SKILL_MARKDOWN, /Do not infer\s+or migrate placeholder or abbreviated labels/);
    assert.match(SKILL_MARKDOWN, /Only an explicit council\s+start or renewal replaces the entire matrix/);
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