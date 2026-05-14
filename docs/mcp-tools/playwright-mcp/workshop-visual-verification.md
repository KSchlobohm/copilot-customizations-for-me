# Workshop: Visual Verification in Action

## Scenario: Fix a CSS Layout Bug

You have a web page where a centered hero section isn't actually centering on mobile viewports. Let's walk through how Playwright MCP transforms this workflow.

## Prerequisites for this workshop
- A running local web app (any framework — React, Next.js, plain HTML, etc.)
- Playwright MCP configured and verified (see [setup guide](README.md))
- A CSS layout issue to fix (or introduce one intentionally for learning)

---

## Step 1: Describe the problem to Copilot

```
The hero section on my homepage should be centered vertically and horizontally,
but on mobile viewport widths it's shifted to the left. Can you take a screenshot
of http://localhost:3000 at a 375px viewport width so we can see the issue?
```

**Expected outcome:** Copilot uses Playwright to navigate to your app, sets the viewport to 375px wide, and captures a screenshot. You (and Copilot) can now see the misalignment.

## Step 2: Let Copilot analyze and fix

```
Based on what you see in that screenshot, can you identify why the hero section
isn't centered and propose a CSS fix?
```

**Expected outcome:** Copilot examines the screenshot, cross-references your CSS code, and identifies the issue (e.g., missing `margin: 0 auto`, incorrect flex properties, or a fixed-width element overflowing).

## Step 3: Apply the fix and verify

```
Apply that fix and take another screenshot at the same viewport width so we can
confirm it's resolved.
```

**Expected outcome:** Copilot edits the CSS, takes a new screenshot, and you can visually confirm the hero section is now centered.

## Step 4: Check for regressions

```
Now take a screenshot at 1440px width to make sure the desktop layout still
looks correct.
```

**Expected outcome:** Copilot screenshots the desktop viewport, confirming the mobile fix didn't break the desktop layout.

---

## The "Aha" Moment

Notice what just happened:
1. **No manual browser switching** — you stayed in your editor/terminal the entire time
2. **Copilot saw the problem itself** — you didn't have to describe pixel-level details
3. **Instant feedback loop** — fix → screenshot → confirm, all in one conversation
4. **Regression check built in** — testing multiple viewports took seconds, not minutes

This workflow is impossible without Playwright MCP. With it, CSS and visual work becomes a collaborative conversation instead of a back-and-forth of "try this, no that's not right, try again."
