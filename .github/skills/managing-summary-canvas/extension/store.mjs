// Durable per-document storage for this canvas.
//
// Instances (instanceId) are transient panel handles; the markdown content
// is keyed by a caller-supplied `documentId` (e.g. "issue-42") so a reload,
// extension restart, or a second panel opened on the same document all see
// the same content. Storage lives under the user-scope extension's own
// artifacts directory (not the repo, not module memory).

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const COPILOT_HOME = process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot");
const ARTIFACTS_DIR = path.join(COPILOT_HOME, "extensions", "conversation-summary-canvas", "artifacts");

function sanitizeDocumentId(documentId) {
    return String(documentId).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "untitled";
}

function docPath(documentId) {
    return path.join(ARTIFACTS_DIR, `${sanitizeDocumentId(documentId)}.json`);
}

function sanitizeInstanceId(instanceId) {
    return String(instanceId).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "unknown";
}

function instancePath(instanceId) {
    return path.join(ARTIFACTS_DIR, "instances", `${sanitizeInstanceId(instanceId)}.json`);
}

export async function loadDocument(documentId) {
    try {
        const raw = await readFile(docPath(documentId), "utf8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export async function saveDocument(documentId, data) {
    await mkdir(ARTIFACTS_DIR, { recursive: true });
    await writeFile(docPath(documentId), JSON.stringify(data, null, 2), "utf8");
}

// Durable instanceId -> documentId index, so a fresh extension process (e.g.
// after `extensions_reload`) can still resolve `get_state`/`update_markdown`
// calls against a previously-open instanceId, without waiting for the host
// to re-invoke `open()` first (Bug 2).
export async function saveInstanceMapping(instanceId, documentId) {
    await mkdir(path.dirname(instancePath(instanceId)), { recursive: true });
    await writeFile(instancePath(instanceId), JSON.stringify({ documentId }, null, 2), "utf8");
}

export async function deleteInstanceMapping(instanceId) {
    try {
        await unlink(instancePath(instanceId));
    } catch {
        // already gone or never existed
    }
}

export async function loadInstanceMapping(instanceId) {
    try {
        const raw = await readFile(instancePath(instanceId), "utf8");
        return JSON.parse(raw)?.documentId ?? null;
    } catch {
        return null;
    }
}
