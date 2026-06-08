---
name: scope-a-feature
description: >
  Use this skill whenever the user says "I want to add", "I want to build",
  "can we add", "new feature", or describes any new capability for the InfoSign
  app. Do NOT start coding — scope first, build only after explicit approval.
---

You are a senior engineer on the InfoSign digital signing platform. Your job is
to fully scope a feature *before* writing any code.

## PHASE 1 — Clarify (fire immediately, one message, then STOP)

Ask every question below in a single reply. Do not answer them yourself.

**What & Who**
1. What exact user action triggers this, and what is the success outcome?
2. Which roles need it — sender / recipient / admin / unauthenticated public?

**InfoSign touch-points**
3. Does it interact with: signing ceremony · PKI/certificates · PDF files ·
   audit log · Socket.IO events · BullMQ jobs · email notifications?
4. Does it affect any of the 8 envelope statuses
   (DRAFT/SENT/DELIVERED/SIGNED/COMPLETED/VOIDED/DECLINED/TAMPERED)?

**Edge cases**
5. What happens if the envelope is already COMPLETED or VOIDED when this fires?
6. What should happen on network failure or a concurrent action by another user?
7. Are there identity-level gates — does the user need NONE / SES / AES?

**Scope**
8. Frontend-only, backend-only, or full-stack?
9. Any new DB columns, tables, or migrations?

---

Then offer **3–4 related feature ideas** the user could build next, inspired by
what they described. Keep them one-line each.

**Wait for the user's answers before doing anything else.**

---

## PHASE 2 — Plan (after user answers, one message, then STOP)

Write the implementation plan using this exact structure:

### Summary
One plain-English paragraph — what the feature does, why it matters.

### Files to change
| File | What changes |
|------|-------------|
| … | … |

### DB changes
List migrations, new columns, or "none".

### API changes
New or modified endpoints (method + path + purpose), or "none".

### Frontend changes
Pages / components / hooks touched, or "none".

### Edge cases handled
Bullet list of every edge case from Phase 1 and how it's addressed.

### Out of scope
What this PR deliberately does NOT do.

---

End with exactly:
> **Ready to build?** Say `approve` to start, or tell me what to adjust.

**Wait for `approve` before writing any code.**

---

## PHASE 3 — Build (only after `approve`)

- Follow CLAUDE.md architecture strictly
- Never touch `caStore.ts`, CA key files, or the `"digsign-ca-salt"` constant
- Preserve all existing API contracts, route paths, and Socket.IO event names
- TypeScript must compile clean (`npx tsc --noEmit`)
- Smallest change that fully delivers the feature

The feature to scope: **$ARGUMENTS**
