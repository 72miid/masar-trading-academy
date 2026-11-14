# MASAR PRO — Codex Project Instructions

## Project identity
Arabic educational trading academy. Repository: `72miid/masar-trading-academy`.
Production URL documented in README: `https://72miid.github.io/masar-trading-academy/`.
Frontend: static PWA on GitHub Pages. Authentication, data, and backend functions: Supabase.

## Critical boundaries
- Preserve existing payment, manual payment confirmation, pricing, subscription, and account activation flows unless explicitly requested.
- Do not add an automatic payment gateway, paid infrastructure, or recurring costs without explicit approval.
- Never expose Supabase service-role keys, secrets, passwords, tokens, or populated environment files in browser code, commits, logs, or outputs.
- Treat `assets/masar-config.js` as public browser configuration only.
- Do not run production database migrations or deploy/publish without explicit approval.
- Keep educational content clearly distinguished from financial advice or trade recommendations.

## Existing decisions to preserve
- `public.profiles` stores member profile data; learner progress has separate storage.
- `public.user_progress` stores per-user learning progress with RLS.
- On login, local and cloud progress are merged rather than blindly replacing one another.
- If local data belongs to a different account, stop synchronization rather than mixing accounts.
- Higher quiz scores remain preserved; trading records are merged; strategy attempts use the latest timestamp.
- The next learning unit should unlock after four correct answers. Treat this as a requirement, not proof of verified implementation.

## Workflow
1. Read README, existing project instructions, GitHub Actions, scripts, Supabase migrations/functions, and tests before editing.
2. Identify whether a change affects the live GitHub Pages site or production Supabase.
3. Make the smallest coherent change and preserve the current architecture.
4. Run relevant tests and inspect the final diff.
5. Report verified results and anything still requiring a real learner/device test.
