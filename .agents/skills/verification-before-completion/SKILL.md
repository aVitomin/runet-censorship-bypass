---
name: verification-before-completion
description: Verify concrete completion, correctness, build, test, or documentation claims with fresh evidence before reporting success.
---

# Verification before completion

Use only through explicit `$verification-before-completion` invocation.

## Gate

Before a success claim:

1. State the exact claim and evidence that would prove it.
2. Read applicable instructions and select the smallest complete final gate for
   the changed paths. Focused feedback alone does not prove completion.
3. Run each selected command on the current tree. Record command, exit status,
   failures, and warnings relevant to the claim.
4. Inspect the complete relevant diff and status. Independently verify
   delegated results.
5. Claim success only when evidence proves it. Otherwise report the failure or
   unavailable check and its effect.

For agent/skill/docs-only changes, run docs integrity, relevant skill/metadata
validation, and whitespace checks; do not run product/browser/release gates.
For runtime, security, dependency, routing, browser, or release work, follow the
root path table and applicable safety skills. Do not mutate product files,
install, publish, commit, push, or alter external state merely to verify.

Summarize successful commands with exit status instead of pasting full logs;
retain complete output in the transcript. For failures, include diagnostic
output and where the full log is available. Never infer one gate from another
unless the invoked script actually includes it.

| Claim | Fresh evidence |
| --- | --- |
| Tests/build pass | Applicable command exits zero with no relevant failures |
| Bug fixed | Original symptom or regression case passes |
| Skill resolves | Client selector/resolver or explicit load finds project path |
| Skill invoked | Fresh model run loads and applies it |
| Requirements met | Requirement-by-requirement review plus applicable gates |

## Provenance and adaptation

Adapted from
[`obra/superpowers/skills/verification-before-completion/SKILL.md`](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/verification-before-completion/SKILL.md)
at commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` under the MIT license in
[`../SUPERPOWERS-LICENSE`](../SUPERPOWERS-LICENSE). This adaptation keeps the
evidence-before-claims gate, makes check selection path-sensitive, and prevents
instruction-only work from triggering unrelated runtime or release checks.
