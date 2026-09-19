---
name: writing-skills
description: Create or revise Codex skills when scope, discovery metadata, instructions, references, or behavioral validation need deliberate design.
---

# Writing skills

Use only through explicit `$writing-skills` invocation.

## Workflow

1. Read repository/scoped instructions. If the built-in `skill-creator` exists,
   read it and treat its supported structure and metadata as authoritative; do
   not install or copy another creator.
2. Define the skill's job, triggers, exclusions, inputs/outputs, and side-effect
   boundary. Preserve user scope and repository invariants.
3. For new or materially changed behavior, write a realistic synthetic scenario
   first and capture a safe baseline when possible. A metadata-only correction
   may record why behavioral baseline testing is not useful.
4. Match guidance to the observed failure: a skipped rule needs a firm boundary;
   a wrong shape needs a positive contract; an omitted field needs a required
   slot; conditional behavior needs an observable predicate.
5. Keep `SKILL.md` focused. Demand-load substantial conditional detail from
   directly linked references. Do not reference unavailable files, roles,
   skills, or tools, and add executable helpers only for a demonstrated need.
6. Preserve `policy.allow_implicit_invocation: false` when explicit-only use is
   requested. Validate frontmatter, metadata, links, and the complete diff.
7. Run one bounded behavior test appropriate to the skill: pressure for a rule,
   a new application for a technique, retrieval for a reference, or resolver
   plus explicit load for metadata.

An actual test is a fresh model invocation with the skill loaded; a static
walkthrough is not. Use synthetic input and a read-only sandbox when product
changes are unnecessary. If safe invocation is unavailable, report the gap
instead of inventing a subagent or tool.

## Boundaries and evidence

Keep project skills in `.agents/skills`; preserve existing safety-skill
triggers. Do not add global configuration, plugins, frameworks, hooks,
dependencies, or unrelated product checks. Do not commit or publish without
separate authorization.

Report changed files, source/license for adapted material, adaptations,
validator and invocation evidence, limitations, and final status.

## Provenance and adaptation

Adapted from
[`obra/superpowers/skills/writing-skills/SKILL.md`](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/writing-skills/SKILL.md)
at commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` under the MIT license in
[`../SUPERPOWERS-LICENSE`](../SUPERPOWERS-LICENSE). This Codex adaptation keeps
scenario-based RED/GREEN-style testing and failure-shaped guidance, uses the
built-in creator as format authority, and omits the unselected TDD skill,
Claude-specific guidance, bootstrap/hooks, graph helpers, mandatory subagents,
and upstream commit/push steps.
