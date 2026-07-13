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
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// COPILOT_HOME must be set before store.mjs is imported, since it computes
// ARTIFACTS_DIR at module load time.
const tmpHome = await mkdtemp(path.join(os.tmpdir(), "csc-store-test-"));
process.env.COPILOT_HOME = tmpHome;

const { loadDocument, saveDocument, loadInstanceMapping, saveInstanceMapping } = await import("./store.mjs");

const CODE_MATRIX = `## Reviewer Matrix

| Reviewer | Safe to Merge | Closes Scope |
|---|---|---|
| GPT-5.x | ⏳ Not yet reviewed | ⏳ Not yet reviewed |`;

const WRITING_MATRIX = `## Reviewer Matrix

| Reviewer | Evidence & Consistency | Readability & Tone |
|---|---|---|
| GPT-5.x | ⏳ Not yet reviewed | ⏳ Not yet reviewed |`;

test("saveDocument then loadDocument round-trips the exact content written (Bug 4 precondition)", async () => {
    const markdown = `## Action Items\n- [ ] a\n\n${CODE_MATRIX}`;
    await saveDocument("doc-1", { title: "Doc One", markdown });
    const doc = await loadDocument("doc-1");
    assert.equal(doc.title, "Doc One");
    assert.equal(doc.markdown, markdown);
    assert.match(doc.markdown, /\| Reviewer \| Safe to Merge \| Closes Scope \|/);
});

test("writing reviewer headers survive durable reload and a full-document update", async () => {
    const initial = `## Action Items\n- [ ] Draft article\n\n${WRITING_MATRIX}`;
    await saveDocument("writing-doc", { title: "Writing", markdown: initial });
    assert.equal((await loadDocument("writing-doc")).markdown, initial);

    const updated = `## Action Items\n- [x] Draft article\n- [ ] Copy edit\n\n${WRITING_MATRIX}`;
    await saveDocument("writing-doc", { title: "Writing", markdown: updated });
    const reloaded = await loadDocument("writing-doc");
    assert.equal(reloaded.markdown, updated);
    assert.match(reloaded.markdown, /\| Reviewer \| Evidence & Consistency \| Readability & Tone \|/);
});

test("reviewer identity labels (including distinct reasoning depths and unknown metadata) survive resume/reload unchanged", async () => {
    const markdown = `## Reviewer Matrix
| Reviewer | Safe to Merge | Closes Scope |
|---|---|---|
| GPT-5.6 (reasoning: high) | ✅ Pass | ✅ Pass |
| GPT-5.6 (reasoning: xhigh) | ⚠️ Pass with concerns | ✅ Pass |
| Claude Haiku 4.5 | ✅ Pass | ✅ Pass |
| (Model family unknown) (Version unknown) | ⏳ Not yet reviewed | ⏳ Not yet reviewed |`;
    await saveDocument("doc-reviewers", { title: "Matrix", markdown });
    const doc = await loadDocument("doc-reviewers");
    assert.equal(doc.markdown, markdown);
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
    assert.match(doc.markdown, /\| Reviewer \| Safe to Merge \| Closes Scope \|/);
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
