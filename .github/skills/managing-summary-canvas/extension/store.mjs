// Durable per-document storage for this canvas.
//
// Instances (instanceId) are transient panel handles; the markdown content
// is keyed by a caller-supplied `documentId` (e.g. "issue-42") so a reload,
// extension restart, or a second panel opened on the same document all see
// the same content. Storage lives under the user-scope extension's own
// artifacts directory (not the repo, not module memory).

import { mkdir, readFile, writeFile } from "node:fs/promises";
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
