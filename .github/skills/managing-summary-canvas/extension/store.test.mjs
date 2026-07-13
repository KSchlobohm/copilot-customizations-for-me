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

test("saveDocument then loadDocument round-trips the exact content written (Bug 4 precondition)", async () => {
    await saveDocument("doc-1", { title: "Doc One", markdown: "## Action Items\n- [ ] a" });
    const doc = await loadDocument("doc-1");
    assert.equal(doc.title, "Doc One");
    assert.equal(doc.markdown, "## Action Items\n- [ ] a");
});

test("reviewer identity labels (including distinct reasoning depths and unknown metadata) survive resume/reload unchanged", async () => {
    const markdown = `## Reviewer Matrix
| Reviewer | Safe to Merge | Closes Scope |
|---|---|---|
| GPT-5.6 (reasoning: high) | ✅ Pass | ✅ Pass |
| GPT-5.6 (reasoning: xhigh) | ⚠️ Pass with concerns | ✅ Pass |
| (Model family unknown) (Version unknown) (reasoning: unknown) | ⏳ Not yet reviewed | ⏳ Not yet reviewed |`;
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
    assert.equal(doc.markdown, "## Action Items\n- [ ] a");
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
