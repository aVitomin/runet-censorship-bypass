---
name: requesting-code-review
description: Request a focused review of a working-tree diff or revision range when independent findings would reduce implementation or integration risk.
---

# Requesting code review

Use only through explicit `$requesting-code-review` invocation. Review permits
inspection and reporting, not fixes or repository/external mutations.

## Request

1. Read applicable instructions. Use the user's revision range; otherwise
   review staged, unstaged, and relevant untracked work. Never assume `HEAD~1`
   is the task.
2. Supply requirements, affected paths, pre-edit obligations, and actual check
   evidence without exposing secrets or unrelated user work.
3. Read [`references/code-reviewer.md`](references/code-reviewer.md) completely.
4. If an allowed reviewer tool exists, dispatch exactly one fresh reviewer with
   minimal context and no recursive delegation. Do not invent a role or tool.
   Otherwise perform the same read-only work locally and label it self-review.

## Findings

Verify reviewer claims against the diff. Lead with confirmed findings by
severity and precise location; separate questions and residual risks. Critical
issues block readiness. Important issues require a fix or explicit user
decision. Minor issues do not expand scope silently. A no-findings report must
state coverage and unverified checks. Fix findings only when implementation is
within the user's request.

## Provenance and adaptation

Adapted from
[`obra/superpowers/skills/requesting-code-review/SKILL.md`](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/requesting-code-review/SKILL.md)
and its reviewer template at commit
`b36e0829c6d0140e93cfef2ca599b1b07d4a7797`, under the MIT license in
[`../SUPERPOWERS-LICENSE`](../SUPERPOWERS-LICENSE). This adaptation removes the
assumed `general-purpose` role, adds a disclosed self-review fallback, covers
uncommitted work, requires findings-first output, and preserves read-only scope.
