# Workshop: Visual Verification in Action

## Scenario: Inspect and Understand a Page Layout

Let's walk through how Playwright MCP transforms visual workflows — using a public site so there's nothing to set up.

## Prerequisites for this workshop
- Playwright MCP configured and verified (see [setup guide](README.md))
- That's it — no local app needed

---

## Step 1: Capture a baseline screenshot

```
Navigate to https://playwright.dev and take a screenshot at a 1440px viewport width.
```

**Expected outcome:** Copilot uses Playwright to navigate to the site and captures a full-width screenshot. You can see the desktop layout of the Playwright docs homepage.

## Step 2: Compare a mobile viewport

```
Now take a screenshot of the same page at 375px viewport width so we can see
how the layout responds on mobile.
```

**Expected outcome:** Copilot captures a mobile-width screenshot. You can immediately compare how the navigation, hero section, and content reflow for smaller screens.

## Step 3: Ask Copilot to analyze what it sees

```
Compare the two screenshots. What layout changes do you notice between the
desktop and mobile viewports? How is the navigation handled differently?
```

**Expected outcome:** Copilot describes the responsive design choices — hamburger menu vs full nav, stacked vs side-by-side content, font size changes, etc.

## Step 4: Inspect a specific element

```
Take a screenshot of https://playwright.dev/docs/intro at 768px width.
Is the sidebar navigation visible at this breakpoint, or is it collapsed?
```

**Expected outcome:** Copilot navigates to a docs page at tablet width and reports whether the sidebar is visible or hidden behind a toggle.

---

## The "Aha" Moment

Notice what just happened:
1. **No local setup required** — you used a public site with zero configuration
2. **Copilot saw the page itself** — you didn't have to describe what was on screen
3. **Instant viewport comparison** — checking responsive behavior took seconds, not minutes of manual resizing
4. **Natural conversation** — you asked questions about visual layout and got meaningful answers

Now imagine this workflow on *your* project — fix a CSS bug, verify it visually, check for regressions across viewports, all without leaving your editor or terminal.
