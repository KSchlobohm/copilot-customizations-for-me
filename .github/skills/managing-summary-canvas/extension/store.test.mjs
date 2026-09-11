// Regression coverage for the durable store, in particular the
// instanceId -> documentId index added for Bug 2 (a full extension process
// restart, e.g. `extensions_reload`, must not lose track of which
// documentId a previously-open instanceId belongs to). Everything in
// store.mjs is disk-backed with no module-level state, so simply calling
// save then load — as separate, independent calls — already exercises the
// "does this survive a process restart" property without needing to spawn
// a second process.
//
// Run with: node --test .github/skills/managing-summary-canvas/extension/store.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { summarizeActionItems } from "./tasks.mjs";

// COPILOT_HOME must be set before store.mjs is imported, since it computes
// ARTIFACTS_DIR at module load time.
const tmpHome = await mkdtemp(path.join(os.tmpdir(), "csc-store-test-"));
process.env.COPILOT_HOME = tmpHome;

const { loadDocument, saveDocument, loadInstanceMapping, saveInstanceMapping } = await import("./store.mjs");

const skill = (await readFile(new URL("../SKILL.md", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const preferencesBlock = skill.match(/<details>\s*<summary>Review preferences<\/summary>[\s\S]*?<\/details>/)?.[0];
assert.ok(preferencesBlock);
const preferences = JSON.parse(preferencesBlock.match(/```json\s+([\s\S]*?)\s+```/)[1]);

const CODE_MATRIX = `## Reviewer Matrix

| Perspective | Question it owns | Assessment |
|---|---|---|
| Intent | Does saving preserve this document's task states? | ⏳ Pending |
| Failure | Can reopening lose saved content? | ⏳ Pending |
| Maintenance | Does saving reuse the existing document store? | ⏳ Pending |

**Combined recommendation:** ⏳ Pending — review has not started.`;

const WRITING_MATRIX = `## Reviewer Matrix

| Perspective | Question it owns | Assessment |
|---|---|---|
| Purpose & Audience | Can a new contributor follow this setup guide? | ⏳ Pending |
| Evidence & Consistency | Do the documented commands match supported options? | ⏳ Pending |
| Style & Tone | Are the steps clear and direct for first-time readers? | ⏳ Pending |

**Combined recommendation:** ⏳ Pending — review has not started.`;

function profilePreferences(profile, perspectives) {
    return preferencesBlock.replace(/```json[\s\S]*?```/, "```json\n" + JSON.stringify({
        profile,
        seats: preferences.seats.map((seat, index) => ({ ...seat, perspective: perspectives[index] })),
    }) + "\n```");
}

test("saveDocument then loadDocument round-trips the exact content written (Bug 4 precondition)", async () => {
    const markdown = `## Action Items\n- [ ] a\n\n${CODE_MATRIX}`;
    await saveDocument("doc-1", { title: "Doc One", markdown });
    const doc = await loadDocument("doc-1");
    assert.equal(doc.title, "Doc One");
    assert.equal(doc.markdown, markdown);
    assert.match(doc.markdown, /\| Perspective \| Question it owns \| Assessment \|/);
});

test("writing questions and Pending recommendation survive durable reload and a full-document update", async () => {
    const initial = `## Action Items\n- [ ] Draft article\n\n${WRITING_MATRIX}`;
    await saveDocument("writing-doc", { title: "Writing", markdown: initial });
    assert.equal((await loadDocument("writing-doc")).markdown, initial);

    const updated = `## Action Items\n- [x] Draft article\n- [ ] Copy edit\n\n${WRITING_MATRIX}`;
    await saveDocument("writing-doc", { title: "Writing", markdown: updated });
    const reloaded = await loadDocument("writing-doc");
    assert.equal(reloaded.markdown, updated);
    assert.ok(reloaded.markdown.endsWith(WRITING_MATRIX));
});

test("incomplete coverage and separate requested/effective metadata survive reload unchanged", async () => {
    const matrix = CODE_MATRIX
        .replace("| ⏳ Pending |", "| 🚫 Unavailable |")
        .replace("| ⏳ Pending |", "| ⛔ Blocked: required content inaccessible |")
        .replace("| ⏳ Pending |", "| ✅ Pass |")
        .replace("⏳ Pending — review has not started.", "🚫 Incomplete — Intent unavailable; Failure lacks required content.");
    const metadata = preferencesBlock.replace("Current run: not started.",
        "Intent: requested GPT-6 Astra (reasoning: medium); effective model/version/reasoning: unknown.\n\n"
        + "Failure: requested GPT-6 Astra (reasoning: medium); effective model/version/reasoning: unknown.\n\n"
        + "Maintenance: requested GPT-6 Astra (reasoning: medium); effective model/version/reasoning: unknown.");
    const markdown = `${matrix}\n\n${metadata}`;
    await saveDocument("doc-incomplete", { title: "Matrix", markdown });
    const doc = await loadDocument("doc-incomplete");
    assert.equal(doc.markdown, markdown);
    assert.match(doc.markdown, /🚫 Unavailable/);
    assert.match(doc.markdown, /🚫 Incomplete/);
    assert.match(doc.markdown, /effective model\/version\/reasoning: unknown/);
});

test("both profiles preserve questions, repeated-model preferences, and task states across authored refresh and renewal", async () => {
    for (const [profile, matrix, perspectives] of [
        ["code", CODE_MATRIX, ["Intent", "Failure", "Maintenance"]],
        ["writing", WRITING_MATRIX, ["Purpose & Audience", "Evidence & Consistency", "Style & Tone"]],
    ]) {
        const settings = profilePreferences(profile, perspectives);
        const metadata = settings.replace("Current run: not started.", "Current run: effective model/version/reasoning unknown.");
        const completeMatrix = matrix.replaceAll("| ⏳ Pending |", "| ✅ Pass |")
            .replace("⏳ Pending — review has not started.", "✅ Ready — reviewed scope has no outstanding concerns.");
        const completeReview = `${completeMatrix}\n\n${metadata}`;
        const initial = `## Action Items\n- [x] (${perspectives[1]}) Fixed save handling\n- [ ] Prepare handoff\n\n${completeReview}`;
        await saveDocument(profile, { title: profile, markdown: initial });
        const reloaded = await loadDocument(profile);
        assert.equal(reloaded.markdown, initial);

        const taskUpdate = reloaded.markdown.replace("- [ ] Prepare handoff", "- [x] Prepare handoff");
        await saveDocument(profile, { title: profile, markdown: taskUpdate });
        const beforeRenewal = await loadDocument(profile);
        assert.equal(beforeRenewal.markdown, taskUpdate);
        assert.ok(beforeRenewal.markdown.endsWith(completeReview));

        // The agent authors the replacement; the store must not reinterpret it.
        const renewed = beforeRenewal.markdown.replace(completeReview, `${matrix}\n\n${settings}`);
        await saveDocument(profile, { title: profile, markdown: renewed });
        const afterRenewal = await loadDocument(profile);
        assert.equal(afterRenewal.markdown, renewed);
        assert.ok(afterRenewal.markdown.includes(settings));
        assert.deepEqual(summarizeActionItems(afterRenewal.markdown), summarizeActionItems(beforeRenewal.markdown));
        assert.equal([...afterRenewal.markdown.matchAll(/\| ⏳ Pending \|/g)].length, 3);
        assert.equal([...afterRenewal.markdown.matchAll(/\*\*Combined recommendation:\*\*/g)].length, 1);
        assert.doesNotMatch(afterRenewal.markdown, /✅ Ready|Current run: effective/);
    }
});

test("an authored legacy reassessment replacement discards votes but preserves tasks and selected preferences", async () => {
    const actionItems = "## Action Items\n- [x] (Historical reviewer) Fixed save handling\n- [ ] (Maintenance) Resolve duplication";
    const legacyReview = `## Reviewer Matrix

| Reviewer | Safe to Merge | Closes Scope |
|---|---|---|
| Reviewer 1 (not selected) | ⏳ Pending | ⏳ Pending |
| Previous reviewer | ✅ Pass | ✅ Pass |

${preferencesBlock.replace("Current run: not started.", "Current run: previous merge votes.")}`;
    const otherSections = "\n\n## What We Learned\nSaved preferences are not review results.";
    await saveDocument("reassess", { title: "Reassess", markdown: `${actionItems}\n\n${legacyReview}${otherSections}` });
    const before = await loadDocument("reassess");
    const authoredUpdate = before.markdown.replace(legacyReview, `${CODE_MATRIX}\n\n${preferencesBlock}`);
    await saveDocument("reassess", { title: before.title, markdown: authoredUpdate });
    const after = await loadDocument("reassess");
    assert.equal(after.markdown, authoredUpdate);
    assert.deepEqual(summarizeActionItems(after.markdown), summarizeActionItems(before.markdown));
    assert.ok(after.markdown.includes(preferencesBlock));
    assert.ok(after.markdown.endsWith(otherSections));
    assert.doesNotMatch(after.markdown, /Safe to Merge|Closes Scope|Previous reviewer|previous merge votes|✅ Pass/);
    assert.equal([...after.markdown.matchAll(/\| ⏳ Pending \|/g)].length, 3);
    assert.match(after.markdown, /\*\*Combined recommendation:\*\* ⏳ Pending/);
});

test("preferences are per-summary and changing them does not rewrite current results or run metadata", async () => {
    const currentReview = CODE_MATRIX.replaceAll("| ⏳ Pending |", "| ✅ Pass |")
        .replace("⏳ Pending — review has not started.", "✅ Ready — no review concerns.");
    const currentMetadata = preferencesBlock.replace("Current run: not started.", "Intent: requested GPT-6 Astra (reasoning: medium); effective unknown.");
    const initial = `${currentReview}\n\n${currentMetadata}`;
    await saveDocument("preferences-a", { title: "A", markdown: initial });
    await saveDocument("preferences-b", { title: "B", markdown: initial });
    const updated = initial.replaceAll('"reasoning_effort":"medium"', '"reasoning_effort":"high"');
    await saveDocument("preferences-a", { title: "A", markdown: updated });
    assert.equal((await loadDocument("preferences-a")).markdown, updated);
    assert.equal((await loadDocument("preferences-b")).markdown, initial);
    assert.ok(updated.startsWith(currentReview));
    assert.match(updated, /requested GPT-6 Astra \(reasoning: medium\); effective unknown/);
});

test("loadDocument returns null for a documentId that was never saved", async () => {
    assert.equal(await loadDocument("never-saved"), null);
});

test("loadInstanceMapping returns null for an instanceId that was never registered", async () => {
    assert.equal(await loadInstanceMapping("never-registered"), null);
});

test("instanceId -> documentId mapping survives independently of any in-memory instance registry (Bug 2)", async () => {
    await saveInstanceMapping("panel-abc", "doc-1");
    // Simulate a fresh process by only using the disk-backed lookup, never
    // touching any in-memory Map — this is exactly what resolveEntry() in
    // extension.mjs falls back to after extensions_reload wipes `instances`.
    const documentId = await loadInstanceMapping("panel-abc");
    assert.equal(documentId, "doc-1");
    const doc = await loadDocument(documentId);
    assert.match(doc.markdown, /\| Perspective \| Question it owns \| Assessment \|/);
});

test("deleteInstanceMapping removes the mapping so loadInstanceMapping returns null afterward", async () => {
    await saveInstanceMapping("panel-to-delete", "doc-1");
    assert.equal(await loadInstanceMapping("panel-to-delete"), "doc-1");
    const { deleteInstanceMapping } = await import("./store.mjs");
    await deleteInstanceMapping("panel-to-delete");
    assert.equal(await loadInstanceMapping("panel-to-delete"), null);
});

test.after(async () => {
    await rm(tmpHome, { recursive: true, force: true });
});
