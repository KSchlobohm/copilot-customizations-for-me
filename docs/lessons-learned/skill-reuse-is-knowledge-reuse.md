# Skill reuse is really knowledge reuse

When teams talk about skills and evals, it is easy to hear process for process's sake.

The more useful framing is knowledge distribution. In this context, a skill is a reusable instruction artifact: a packaged block of guidance that a coding agent can draw on when it encounters a relevant task. The broader Agent Skills model is described at [agentskills.io](https://agentskills.io). An eval is a structured check on whether that skill activates in the right situations and improves the outcome when it does.

> [!IMPORTANT]
> The more useful framing is not **process standardization**. It is **knowledge distribution**.

## The useful distinction

Skills can serve two very different purposes:

- **personal workflow accelerators**
- **shared knowledge artifacts**

Those are not the same thing.

A personal skill helps one person move faster in a preferred way. A shared skill captures specialized or tribal knowledge, makes it discoverable on demand, and helps more people apply it consistently. That is a different kind of reuse, and it has a stronger reason to exist beyond the individual who authored it.

## Where shared skills create real value

Shared skills matter most when they close knowledge gaps that are otherwise hard to close.

That usually means:

- undocumented internal frameworks or custom platform behavior
- organization-specific patterns and tooling
- migration strategies learned through experience
- decision rules that are known by a few people but not easy to find in docs

In those situations, the skill is not valuable because it dictates one perfect workflow. It is valuable because it makes hard-won knowledge:

- discoverable
- actionable
- more consistently applied

That is the leverage point.

## When evals are worth it

That shift - from personal shortcut to shared knowledge artifact - is what makes evals worth the effort.

When a skill is meant to distribute important knowledge across many tasks or teams, you need confidence that it activates when it should, stays quiet when it should not, and improves outcomes rather than adding noise.

Evals are not inherently valuable. They become valuable when the skill is intended to scale.

If a skill is meant to help many engineers, improve task success across teams, or raise consistency around important patterns, then it is worth measuring and refining. In that case, you can evaluate things like:

- correct activation rate - how often the skill is used when it should be
- incorrect activation rate - how often the skill is pulled in when it should not be
- task impact - whether the skill helps, does not change, or hurts the outcome

If the skill is mainly a personal workflow aid, heavy eval investment is usually unnecessary. Optimize it locally and move on.

## A practical decision rule

Use this distinction:

- **Personal workflow skill** — optimize locally; no need for heavy evals
- **Shared knowledge skill** — invest in evals and refinement when it is meant to scale

That decision rule is much clearer than arguing about evals in the abstract.

## The tension worth keeping

Even with that framing, there is still a limit worth keeping in view.

I am still not convinced by the idea of a universal "golden skill set" that makes every developer dramatically better.

Skills are components, not complete solutions.

Developers still need to compose their own workflows, adapt to their own context, and decide how much structure helps versus constrains. There is a real risk of over-investing in polishing shared artifacts while underestimating the importance of individual judgment and adaptation.

So the limit is worth remembering:

- shared skills can create leverage
- they do not replace personal workflow design

## Reference

- [Agent Skills standard](https://agentskills.io)
