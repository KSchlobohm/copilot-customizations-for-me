// Structural verification for the summary canvas: renders a realistic,
// full-shape document through the *actual* renderer (no mocks) and asserts
// the required layout invariants documented in SKILL.md:
//   - header renders with a working linked issue number
//   - Action Items appears directly below the header
//   - "What Was Built" is collapsed via <details>/<summary>
//   - three perspective-owned assessments and one combined recommendation render
//   - parseActionItems/summarizeActionItems agree with what's on the page
//
// Run with: node --test .github/skills/managing-summary-canvas/extension/verify.test.mjs

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { renderMarkdown } from "./markdown.mjs";
import { summarizeActionItems } from "./tasks.mjs";

const SKILL_MARKDOWN = (await readFile(new URL("../SKILL.md", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const contractLinks = [...SKILL_MARKDOWN.matchAll(/\[reviewer result and recommendation contract\]\(([^)]+)\)/g)];
assert.equal(contractLinks.length, 2, "expected direct contract links at reviewer prompting and aggregation");
assert.ok(contractLinks.every((match) => match[1] === "reviewer-contract.md"), "keep the contract beside SKILL.md");
const REVIEWER_CONTRACT = (await readFile(new URL(`../${contractLinks[0][1]}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const markdownExamples = [...SKILL_MARKDOWN.matchAll(/^```markdown\n([\s\S]*?)\n```$/gm)].map((match) => match[1]);
const scaffold = markdownExamples.find((example) => example.includes("## Reviewer Matrix"));
assert.ok(scaffold, "expected the full summary scaffold in SKILL.md");
const CODE_MATRIX = scaffold.slice(scaffold.indexOf("## Reviewer Matrix"), scaffold.indexOf("## What We Learned")).trim();
const WRITING_TABLE = markdownExamples.find((example) => example.startsWith("| Perspective |"));
assert.ok(WRITING_TABLE, "expected the writing table in SKILL.md");
const WRITING_MATRIX = CODE_MATRIX.replace(/\| Perspective \|[\s\S]*?(?=\n\n)/, WRITING_TABLE);
const PREFERENCES_BLOCK = SKILL_MARKDOWN.match(/<details>\s*<summary>Review preferences<\/summary>[\s\S]*?<\/details>/)?.[0];
assert.ok(PREFERENCES_BLOCK, "expected an inspectable preferences block in SKILL.md");

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

${CODE_MATRIX}

## What We Learned
Markdown link/image syntax and raw-HTML passthrough are both real XSS surfaces
in a hand-rolled renderer; both need explicit sanitization.
`;

const WRITING_SAMPLE_MARKDOWN = SAMPLE_MARKDOWN.replace(CODE_MATRIX, WRITING_MATRIX);

const UNLINKED_SAMPLE_MARKDOWN = `# Work Summary: Unlinked Feature Work

> 💡 **Unlinked Summary**: No GitHub Issue is attached to this work. Ask Copilot to create an issue anytime to link it.

Working on unlinked task tracking support.

## Action Items
- [ ] Implement unlinked summary support
`;

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

for (const { name, markdown, perspectives } of [
    { name: "code", markdown: SAMPLE_MARKDOWN, perspectives: ["Intent", "Failure", "Maintenance"] },
    { name: "writing", markdown: WRITING_SAMPLE_MARKDOWN, perspectives: ["Purpose &amp; Audience", "Evidence &amp; Consistency", "Style &amp; Tone"] },
]) {
    test(`${name} scaffold shows three named perspectives, distinct questions, and one Pending recommendation`, () => {
        const html = renderMarkdown(markdown);
        assert.deepEqual(reviewerHeaders(markdown), ["Perspective", "Question it owns", "Assessment"]);
        const body = html.match(/<tbody>(.*?)<\/tbody>/s)?.[1] ?? "";
        const rows = [...body.matchAll(/<tr>(.*?)<\/tr>/g)]
            .map((row) => [...row[1].matchAll(/<td>(.*?)<\/td>/g)].map((cell) => cell[1]));
        assert.equal(rows.length, 3);
        assert.deepEqual(rows.map((row) => row[0]), perspectives);
        assert.equal(new Set(rows.map((row) => row[1])).size, 3);
        for (const row of rows) {
            assert.equal(row.length, 3);
            assert.match(row[1], /\?$/);
            assert.equal(row[2], "⏳ Pending");
        }
        assert.equal([...html.matchAll(/<strong>Combined recommendation:<\/strong>/g)].length, 1);
        assert.match(html, /Combined recommendation:<\/strong> ⏳ Pending/);
        const recommendation = html.indexOf("<strong>Combined recommendation:");
        assert.ok(recommendation > html.indexOf("</table>"));
        assert.ok(recommendation < html.indexOf("What We Learned"));
        assert.doesNotMatch(html, /Review preferences|Current run:|gpt-6-astra/);
        assert.doesNotMatch(html, /Reviewer [123]|not selected|Safe to Merge|Closes Scope|GPT-|Model family unknown/);
    });
}

test("layout guidance requires the preferences block only after preferences are resolved", () => {
    const rules = SKILL_MARKDOWN.slice(SKILL_MARKDOWN.indexOf("Rules:"), SKILL_MARKDOWN.indexOf("### Running a model council"));
    assert.match(rules, /Only when preferences have been resolved, follow it\s+with a collapsed "Review preferences" block/);
    assert.match(SKILL_MARKDOWN, /Persist the profile and three preferences in the Reviewer Matrix's collapsed\s+"Review preferences" block before launching/);
});

test("the documented preferences block keeps the default separate from current-run metadata", () => {
    const preferences = JSON.parse(PREFERENCES_BLOCK.match(/```json\s+([\s\S]*?)\s+```/)[1]);
    assert.equal(preferences.profile, "code");
    assert.deepEqual(preferences.seats, ["Intent", "Failure", "Maintenance"].map((perspective) => ({
        perspective, model: "gpt-6-astra", reasoning_effort: "medium",
    })));
    const html = renderMarkdown(PREFERENCES_BLOCK);
    assert.match(html, /<details>\s*<summary>Review preferences<\/summary>/);
    assert.match(html, /<pre><code class="language-json">/);
    assert.match(html, /Current run: not started/);
    assert.doesNotMatch(html, /<details open/);
});

test("repeated models and unknown effective metadata render only in the collapsed block", () => {
    for (const matrix of [CODE_MATRIX, WRITING_MATRIX]) {
        const perspectives = [...matrix.matchAll(/^\| ([^|]+) \| [^|]+ \| ⏳ Pending \|$/gm)].map((match) => match[1]);
        const preferences = {
            profile: matrix === CODE_MATRIX ? "code" : "writing",
            seats: perspectives.map((perspective) => ({ perspective, model: "gpt-6-astra", reasoning_effort: "medium" })),
        };
        const metadata = PREFERENCES_BLOCK
            .replace(/```json[\s\S]*?```/, "```json\n" + JSON.stringify(preferences) + "\n```")
            .replace("Current run: not started.", perspectives.map((perspective) =>
                `${perspective}: requested GPT-6 Astra (reasoning: medium); effective model/version/reasoning: unknown.`
            ).join("\n\n"));
        const html = renderMarkdown(SAMPLE_MARKDOWN.replace(CODE_MATRIX, `${matrix}\n\n${metadata}`));
        const table = html.match(/<table>[\s\S]*?<\/table>/)[0];
        assert.equal([...table.matchAll(/<td>⏳ Pending<\/td>/g)].length, 3);
        assert.doesNotMatch(table, /GPT|reasoning|unknown/);
        const details = html.match(/<details>\s*<summary>Review preferences<\/summary>[\s\S]*?<\/details>/)?.[0];
        assert.ok(details, "expected a collapsed preferences block");
        assert.equal([...details.matchAll(/requested GPT-6 Astra/g)].length, 3);
        assert.equal([...details.matchAll(/effective model\/version\/reasoning: unknown/g)].length, 3);
        assert.doesNotMatch(details, /<details open/);
        assert.ok(html.indexOf("<summary>Review preferences</summary>") > html.indexOf("<strong>Combined recommendation:"));
        assert.ok(html.indexOf("<summary>Review preferences</summary>") < html.indexOf("What We Learned"));
    }
});

test("profile and question selection precede composition and are retained on reruns", () => {
    assert.match(SKILL_MARKDOWN, /before composing even a pending table/);
    assert.match(SKILL_MARKDOWN, /\[Deliverable-specific perspectives\]\(#deliverable-specific-perspectives\)/);
    assert.match(SKILL_MARKDOWN, /it is not automatically code work/);
    assert.match(SKILL_MARKDOWN, /For mixed work, use the primary outcome/);
    assert.match(SKILL_MARKDOWN, /classification or coverage is materially ambiguous, ask one\s+focused question before composing or launching/);
    assert.match(SKILL_MARKDOWN, /Retain the selected profile and owned questions on reruns unless the deliverable\s+changes or the user overrides them/);
    assert.match(SKILL_MARKDOWN, /Question wording should identify this\s+deliverable's scope/);
    assert.match(SKILL_MARKDOWN, /do not invent a third profile/);
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
    assert.match(SKILL_MARKDOWN, /Showing or updating the reviewer matrix never starts reviewers/);
    assert.match(SKILL_MARKDOWN, /Create a new reviewer session for every seat/);
    assert.match(SKILL_MARKDOWN, /Never reuse an existing\s+review or rubber-duck session/);
    assert.match(SKILL_MARKDOWN, /Use one separate\s+`task` call per seat and launch all three calls together in one\s+`multi_tool_use\.parallel` invocation/);
    assert.match(SKILL_MARKDOWN, /Do not reuse an existing `agent_id`\s+through `write_agent`/);
});

test("skill guidance remembers per-summary choices and does not silently substitute models", () => {
    assert.match(SKILL_MARKDOWN, /Selection order: explicit user override, saved per-summary preferences, then\s+the default above/);
    assert.match(SKILL_MARKDOWN, /remembered for that summary, not globally/);
    assert.match(SKILL_MARKDOWN, /Read this\s+block on resume; preserve selected preferences through refreshes, task edits,\s+and renewals, separately from current-run metadata/);
    assert.match(SKILL_MARKDOWN, /malformed or conflicts with the three-seat profile, ask/);
    assert.match(SKILL_MARKDOWN, /If a selection is unavailable\s+or ambiguous, ask the user/);
    assert.match(SKILL_MARKDOWN, /runtime\s+default for that model rather than transferring another model's reasoning level/);
    assert.match(SKILL_MARKDOWN, /retain\s+model preferences by seat number/);
    assert.match(SKILL_MARKDOWN, /Do not pass historical markers such as `runtime-default` as literal model IDs/);
    assert.match(SKILL_MARKDOWN, /Never present requested settings as independently verified effective settings/);
    assert.match(SKILL_MARKDOWN, /Unknown family\/version\/reasoning\s+stays unknown/);
    assert.match(SKILL_MARKDOWN, /A preference-only change leaves current results and their run metadata intact/);
    assert.doesNotMatch(SKILL_MARKDOWN, /copilot --model auto/);
});

test("the workflow loads the companion contract for prompting and synthesis without nested references", () => {
    assert.match(SKILL_MARKDOWN, /Read the\s+\[reviewer result and recommendation contract\]\(reviewer-contract\.md\) and\s+include its result contract in every reviewer prompt/);
    assert.match(SKILL_MARKDOWN, /Apply the combined recommendation rules in the\s+\[reviewer result and recommendation contract\]\(reviewer-contract\.md\)/);
    assert.doesNotMatch(SKILL_MARKDOWN, /#### Reviewer result contract|#### Combined recommendation|^Perspective:|^\| Condition \|/m);
    assert.doesNotMatch(REVIEWER_CONTRACT, /\[[^\]]+\]\([^)]+\)|^\[[^\]]+\]:/m, "the companion must not chain to another reference");
});

test("reviewer contract requests one owned assessment and separate cross-cutting blockers, never overall votes", () => {
    const result = REVIEWER_CONTRACT.match(/```text\n([\s\S]*?)\n```/)?.[1];
    assert.ok(result, "expected an explicit prompt/result contract");
    for (const field of ["Perspective", "Question", "Assessment", "Rationale", "Findings", "Cross-cutting blockers"]) {
        assert.match(result, new RegExp(`^${field}:`, "m"));
    }
    assert.match(result, /^Assessment: <✅ Pass \/ ⚠️ Pass with concerns \/ ❌ Fail \/ ⛔ Blocked: required content inaccessible>$/m);
    assert.match(result, /blocking\/non-blocking severity/);
    assert.match(SKILL_MARKDOWN, /Each reviewer\s+assesses only its owned question/);
    assert.match(REVIEWER_CONTRACT, /Do not request a merge vote, answers to other perspectives' questions, or a\s+combined recommendation from an individual reviewer/);
    assert.match(REVIEWER_CONTRACT, /Missing required fields,\s+mismatched perspective\/question, invalid status, or contradictory assessment\/findings\s+are unusable output; apply the retry rule rather than inferring a Pass/);
    assert.match(REVIEWER_CONTRACT, /Keep rationale in synthesis, not a new column; effective metadata needs runtime evidence/);
    assert.match(SKILL_MARKDOWN, /Style and tone are\s+substantive scope for writing/);
    assert.match(SKILL_MARKDOWN, /Perspectives are primary assignments, not blinders/);
    assert.doesNotMatch(SKILL_MARKDOWN, /Every reviewer still evaluates|returns both matrix verdicts|\| Reviewer \||Reviewer [123] \(not selected\)/);
});

test("combined recommendation guidance prioritizes coverage and blockers over all-pass assessments", () => {
    const section = REVIEWER_CONTRACT.slice(REVIEWER_CONTRACT.indexOf("## Combined recommendation"));
    const rules = [...section.matchAll(/^\| (.*?) \| (.*?) \|$/gm)].slice(1);
    assert.deepEqual(rules.map((match) => [match[1], match[2]]), [
        ["Reviews have not started or any seat is still running", "⏳ Pending"],
        ["All seats terminal, but any is Unavailable or Blocked", "🚫 Incomplete"],
        ["Complete coverage, with any Fail or unresolved blocking concern", "❌ Not ready"],
        ["Complete coverage, with any Pass with concerns or unresolved non-blocking review concern", "⚠️ Ready with concerns"],
        ["Complete coverage, all Pass, and no unresolved review concerns", "✅ Ready"],
    ]);
    assert.match(section, /Apply these rules in order/);
    assert.match(section, /A cross-cutting blocker prevents Ready even if\s+all owned questions pass/);
    assert.match(section, /Reconcile known unresolved blocking Action Items/);
    assert.match(section, /Ordinary open\s+tasks are not automatically review blockers/);
    assert.match(section, /Always surface known blockers and missing coverage/);
    assert.match(section, /not majority votes or model rankings/);
    assert.match(section, /Complete coverage means all three perspectives have usable assessments/);
    assert.match(section, /Never automatically dispose items/);
    assert.match(section, /Independent sessions are not evidence of model diversity when models repeat/);
    assert.match(section, /not an automated merge gate\s+or permission to publish/);
});

test("assessment and combined recommendation states render without extra columns or recommendations", () => {
    for (const [assessment, recommendation] of [
        ["⏳ Pending", "⏳ Pending"],
        ["🚫 Unavailable", "🚫 Incomplete"],
        ["⛔ Blocked: required content inaccessible", "🚫 Incomplete"],
        ["❌ Fail", "❌ Not ready"],
        ["⚠️ Pass with concerns", "⚠️ Ready with concerns"],
        ["✅ Pass", "✅ Ready"],
        ["✅ Pass", "❌ Not ready"],
    ]) {
        const matrix = CODE_MATRIX.replaceAll("| ⏳ Pending |", `| ${assessment} |`)
            .replace("⏳ Pending — review has not started.", `${recommendation} — scope and concerns assessed.`);
        const html = renderMarkdown(matrix);
        assert.deepEqual(reviewerHeaders(matrix), ["Perspective", "Question it owns", "Assessment"]);
        assert.equal([...html.matchAll(/<strong>Combined recommendation:<\/strong>/g)].length, 1);
        assert.ok(html.includes(`<strong>Combined recommendation:</strong> ${recommendation}`));
        assert.equal([...html.matchAll(/<td>/g)].length, 9);
        assert.ok(html.includes(`<td>${assessment}</td>`));
    }
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
    assert.match(REVIEWER_CONTRACT, /not an automated merge gate/);
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

test("skill guidance replaces legacy reviews for reassessment without preserving old votes", () => {
    assert.match(SKILL_MARKDOWN, /On a full-summary or\s+matrix refresh, replace any legacy review section with the new contract/);
    assert.match(SKILL_MARKDOWN, /reset assessments and the combined recommendation to Pending/);
    assert.match(SKILL_MARKDOWN, /Discard old\s+votes and current-run claims rather than translating or preserving old council\s+behavior/);
    assert.match(SKILL_MARKDOWN, /Preserve Action Items, checkbox states, historical attribution,\s+selected model preferences, and other sections/);
    assert.match(SKILL_MARKDOWN, /Report the reset in chat;\s+do not start reviewers/);
    assert.match(SKILL_MARKDOWN, /There is no legacy-layout compatibility path/);
});

test("skill guidance preserves current-format review state and renews without changing Action Items", () => {
    assert.match(SKILL_MARKDOWN, /ordinary refreshes preserve\s+its profile, questions, assessments, combined recommendation, and run metadata/);
    assert.match(SKILL_MARKDOWN, /Task-only edits leave the entire\s+review section untouched/);
    assert.match(SKILL_MARKDOWN, /On explicit renewal, replace current results and run metadata with a fresh\s+review/);
    assert.match(SKILL_MARKDOWN, /Do not keep previous matrices or recommendations/);
    assert.match(SKILL_MARKDOWN, /Preserve all Action Items\s+and their checkbox states/);
    assert.match(SKILL_MARKDOWN, /renewal never deletes, resets, or completes them/);
    assert.match(SKILL_MARKDOWN, /fixed, deferred, accepted, or\s+explicitly not planned/);
});

test("skill guidance attributes Action Items by perspective when models repeat", () => {
    assert.match(SKILL_MARKDOWN, /attributed by perspective/);
    assert.match(SKILL_MARKDOWN, /`- \[x\] \(Failure\)/);
    assert.match(SKILL_MARKDOWN, /`- \[ \] \(Intent, Maintenance\)/);
    assert.match(SKILL_MARKDOWN, /Preserve historical attribution on existing items/);
});

test("skill guidance safely rehydrates existing canvases before updating", () => {
    assert.match(SKILL_MARKDOWN, /Reopening an existing `documentId` with no live instance/);
    assert.match(SKILL_MARKDOWN, /omit `markdown` so\s+the extension rehydrates the saved document/);
    assert.match(SKILL_MARKDOWN, /Never send recomposed Markdown before reading the\s+stored state/);
});

test("the shared skill stays within the authoring size limit", () => {
    const body = SKILL_MARKDOWN.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
    assert.ok(body.trimEnd().split("\n").length < 500, "keep the skill body under 500 lines");
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