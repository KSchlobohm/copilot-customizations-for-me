// Extension: conversation-summary-canvas
//
// Reusable, user-scope canvas that renders a Markdown work summary: issue
// header, pinned Action Items, a condensed "What Was Built", "What We
// Learned", and a reviewer merge-readiness matrix. The canvas itself is a
// generic Markdown -> HTML renderer with a live-refresh action; the section
// structure and ordering are a documented authoring convention owned by the
// paired skill (see the managing-summary-canvas skill), not a schema enforced here.

import { createServer } from "node:http";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";
import { renderPage, renderContent } from "./render.mjs";
import { loadDocument, saveDocument, loadInstanceMapping, saveInstanceMapping } from "./store.mjs";
import { summarizeActionItems } from "./tasks.mjs";

// instanceId -> { server, url, documentId, clients: Set<ServerResponse> }
const instances = new Map();

function sseSend(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function startServer(instanceId) {
    const server = createServer(async (req, res) => {
        const entry = instances.get(instanceId);
        if (!entry) {
            res.statusCode = 404;
            res.end("Instance not found");
            return;
        }

        if (req.url === "/events") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });
            res.write("\n");
            // Register the client *before* the async disk read so a
            // concurrent update_markdown/broadcast() during the read isn't
            // missed. Record the entry's broadcast version first: if a
            // broadcast lands on this client while our own read is still in
            // flight, the version will have moved on and our disk read is
            // now stale relative to what the client already received via
            // that broadcast. In that case, use the broadcast's cached HTML
            // instead of the stale disk snapshot, so we never send an
            // "update" event that visually reverts the canvas to older
            // content after a newer one was already delivered.
            const versionAtSubscribe = entry.version;
            entry.clients.add(res);
            const doc = await loadDocument(entry.documentId);
            const html =
                entry.version !== versionAtSubscribe && entry.lastHtml !== undefined
                    ? entry.lastHtml
                    : renderContent(doc?.markdown ?? "");
            sseSend(res, "update", { html });
            req.on("close", () => entry.clients.delete(res));
            return;
        }

        const doc = await loadDocument(entry.documentId);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(renderPage({ title: doc?.title ?? "Conversation summary", html: renderContent(doc?.markdown ?? "") }));
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

// Resolves an instanceId to a usable entry for get_state/update_markdown,
// even if the in-memory `instances` map was wiped by a full extension
// process restart (`extensions_reload`). Falls back to the durable
// instanceId -> documentId index (Bug 2): document content itself was
// always persisted, only the live registration was memory-only. The
// reconstructed entry has no live HTTP server/clients — that only comes
// back once the host re-calls `open()` — but that's not needed to read or
// write the document.
async function resolveEntry(instanceId) {
    const live = instances.get(instanceId);
    if (live) return live;
    const documentId = await loadInstanceMapping(instanceId);
    if (!documentId) return null;
    return { documentId, clients: new Set(), version: 0, lastHtml: undefined, server: null, url: null };
}

function broadcast(documentId, html) {
    for (const entry of instances.values()) {
        if (entry.documentId !== documentId) continue;
        entry.version += 1;
        entry.lastHtml = html;
        for (const res of entry.clients) {
            sseSend(res, "update", { html });
        }
    }
}

await joinSession({
    canvases: [
        createCanvas({
            id: "conversation-summary-canvas",
            displayName: "Conversation summary",
            description:
                "Renders a Markdown work summary (issue header, pinned action items, condensed build notes, learnings, reviewer merge-readiness matrix). Open once per piece of work with a stable documentId, then refresh it with update_markdown when asked to update the summary.",
            inputSchema: {
                type: "object",
                required: ["documentId"],
                properties: {
                    documentId: {
                        type: "string",
                        description:
                            "Stable id for the document being summarized, independent of any panel instance (e.g. 'issue-42'). Reopening the same documentId shows the same content.",
                    },
                    title: { type: "string", description: "Panel title shown in host chrome." },
                    markdown: {
                        type: "string",
                        description:
                            "Full Markdown content to render. Required the first time a documentId is opened; optional on reopen, where the last saved content for that documentId is reused.",
                    },
                },
            },
            actions: [
                {
                    name: "update_markdown",
                    description:
                        "Replace the rendered Markdown content for an already-open canvas instance and push a live refresh to it. Use this when asked to update the conversation summary canvas.",
                    inputSchema: {
                        type: "object",
                        required: ["markdown"],
                        properties: {
                            markdown: { type: "string", description: "Full replacement Markdown content." },
                            title: { type: "string", description: "Optional updated panel title." },
                        },
                    },
                    handler: async (ctx) => {
                        const entry = await resolveEntry(ctx.instanceId);
                        if (!entry) {
                            throw new CanvasError("instance_not_found", `No open canvas instance '${ctx.instanceId}'.`);
                        }
                        const prior = await loadDocument(entry.documentId);
                        const title = ctx.input.title ?? prior?.title ?? "Conversation summary";
                        await saveDocument(entry.documentId, { title, markdown: ctx.input.markdown });
                        // Read back the just-written document before reporting success
                        // (Bug 4): `get_state` and this handler must never disagree
                        // about what was actually persisted.
                        const verify = await loadDocument(entry.documentId);
                        if (!verify || verify.markdown !== ctx.input.markdown || verify.title !== title) {
                            throw new CanvasError(
                                "write_not_confirmed",
                                `Wrote document '${entry.documentId}' but the read-back did not match; the write may not have persisted.`
                            );
                        }
                        broadcast(entry.documentId, renderContent(ctx.input.markdown));
                        return { ok: true, documentId: entry.documentId };
                    },
                },
                {
                    name: "get_state",
                    description:
                        "Read back the current Markdown content of an already-open canvas instance, plus a parsed summary of its Action Items (total/done/remaining, and each item's text and checked state). Use this to answer questions like 'how many tasks are left?' or to compose an update without having to recall the full document from conversation history.",
                    handler: async (ctx) => {
                        const entry = await resolveEntry(ctx.instanceId);
                        if (!entry) {
                            throw new CanvasError("instance_not_found", `No open canvas instance '${ctx.instanceId}'.`);
                        }
                        const doc = await loadDocument(entry.documentId);
                        const markdown = doc?.markdown ?? "";
                        return {
                            documentId: entry.documentId,
                            title: doc?.title ?? "Conversation summary",
                            markdown,
                            actionItems: summarizeActionItems(markdown),
                        };
                    },
                },
            ],
            // Idempotent: may be re-invoked for the same instanceId after a
            // provider reconnect or `extensions_reload` (reason: "rehydrate").
            // Content lives in the durable per-documentId store, not in
            // memory, so rehydration always reflects the latest saved state.
            open: async (ctx) => {
                const { documentId, title, markdown } = ctx.input ?? {};
                let entry = instances.get(ctx.instanceId);
                if (!entry) {
                    const { server, url } = await startServer(ctx.instanceId);
                    entry = { server, url, documentId, clients: new Set(), version: 0, lastHtml: undefined };
                    instances.set(ctx.instanceId, entry);
                } else {
                    entry.documentId = documentId;
                }
                // Persist the instanceId -> documentId link (Bug 2) so a
                // later extensions_reload can still resolve get_state/
                // update_markdown for this instanceId via resolveEntry(),
                // without needing the host to call open() again first.
                await saveInstanceMapping(ctx.instanceId, documentId);

                const existing = await loadDocument(documentId);
                // First open (or explicit content passed) wins; otherwise
                // rehydrate whatever was last saved for this documentId.
                if (markdown !== undefined || !existing) {
                    const resolvedTitle = title ?? existing?.title ?? "Conversation summary";
                    const resolvedMarkdown = markdown ?? existing?.markdown ?? "";
                    await saveDocument(documentId, { title: resolvedTitle, markdown: resolvedMarkdown });
                    // Re-opening an already-live instance with new content
                    // (e.g. the host re-invoking open() rather than the
                    // agent calling update_markdown) should push a live
                    // refresh too, not just persist silently.
                    if (markdown !== undefined) {
                        broadcast(documentId, renderContent(resolvedMarkdown));
                    }
                }

                return {
                    title: title ?? existing?.title ?? "Conversation summary",
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = instances.get(ctx.instanceId);
                if (entry) {
                    instances.delete(ctx.instanceId);
                    for (const res of entry.clients) {
                        try {
                            // SSE responses are kept alive with
                            // Connection: keep-alive; res.end() alone leaves
                            // the socket open and would make server.close()
                            // below hang waiting for it. Destroy the socket
                            // directly to force it shut.
                            res.destroy();
                        } catch {
                            // ignore
                        }
                    }
                    entry.clients.clear();
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
