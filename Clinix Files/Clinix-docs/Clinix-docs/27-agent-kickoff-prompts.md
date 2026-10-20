# 27 — Coding Agent Kickoff Prompts (new)

Phase-by-phase prompts for a coding agent such as Antigravity. Give the agent the full `docs/` folder as context, then paste one prompt at a time. Each prompt names what is out of scope so the agent does not drift into later phases.

## Phase 1 — Foundation

We're building the AI Healthcare Assistant described in the docs folder, starting with the foundation only. Please read README.md and files 01, 03, 04, 15 and 21 first, then set up a Next.js App Router project in TypeScript with Tailwind and shadcn/ui, following the folder structure in file 03. Connect MongoDB through Mongoose with a cached connection helper, and wire up Auth.js with email and password registration, email verification, login, logout and password reset through Resend. Add the privacy notice and consent capture screens, a basic guest session mechanism, an audit helper and an `.env.example`. Keep the NVIDIA key and every other secret strictly server-side. Do not build the symptom checker, triage rules, AI calls, maps, medication features or dashboard yet, because those belong to later phases.

## Phase 2 — Emergency and safety foundation

Now we're building the emergency and safety foundation. Read files 02, 09, 22, 25 and 17. Create a statically rendered `/emergency` page that works with no database or AI dependency, a country-aware emergency configuration with a bundled fallback JSON (Ghana's 112 as the default), and a persistent emergency button in the global header. Then implement the triage rule engine exactly as file 22 describes, with the rule format, evaluation order, versioning and the post-generation gate function, loading rules from a placeholder reviewed set that I will replace with clinician-approved content. Write thorough unit tests, including paraphrases and typos. Do not call any language model in this phase, and do not claim anywhere that an ambulance has been dispatched.

## Phase 3 — NVIDIA AI integration

Next comes the AI assessment. Read files 05, 06, 12, 23 and 25. Build the NVIDIA client, the Zod assessment schema, the JSON extraction helper, the versioned prompt, and the assessment service with a pre-AI rule check, a bounded retry loop, schema validation and the post-AI safety gate. Expose `/api/ai/assess` and `/api/ai/chat` with validation, rate limiting and the standard error envelope, and build the symptom checker UI with one follow-up question at a time, a visible stop option and the result screen showing urgency first. Treat every clinical field as yes, no or unknown, and make sure an AI failure never produces a reassuring result. Add the golden-case evaluation runner with a handful of placeholder cases. Do not add maps, medication guidance or the dashboard yet.

## Phase 4 — Care navigation

Now add care navigation. Read files 08, 09 and 14. Implement a maps provider interface with one concrete provider, the `/api/facilities` endpoints, the facilities cache with source and verification metadata, a care finder page with list and map views, and a manual location fallback for when permission is denied. Never send symptom text to the maps provider, and always show when hours or contact details are unverified. If the provider fails, fall back to the emergency numbers and a manual search link. Do not add medication features or the dashboard.

## Phase 5 — Medication information

Read files 07 and 22 before starting. Build a medication information module that only returns content from an approved reference source behind an interface, with tri-state handling for age, pregnancy, allergies and current medicines. When any critical field is unknown, the response must refer the patient to a pharmacist or clinician rather than guess. No dosing, no prescription-only recommendations and nothing that delays emergency care. Do not build the dashboard in this phase.

## Phase 6 — Patient dashboard

Read files 10, 11, 15 and 24. Build the patient dashboard pages, the optional health profile, reminders, assessment history and details, the consent management screen, data export and the account deletion workflow with the retention rules from file 24. Scope every query by the authenticated patient and add automated tests proving one user cannot read another user's records by changing an ID. Label assessments as AI-generated and unverified everywhere.

## Phase 7 — Administration and monitoring

Read files 13, 15, 23 and 26. Build the role-based admin area with MFA for non-patient roles, aggregate service-health metrics, triage rule set management with approval workflow, prompt and model version management, feature flags that act as kill switches, an incident workflow, and audited break-glass access to identifiable transcripts. Admins must not see patient content by default.

## Phase 8 — Validation and launch readiness

Read files 17, 18, 24 and 26. Prepare the launch checklist: run the full safety and evaluation suites, security headers, dependency and secret scans, backup restore drill, accessibility audit, rollout plan and rollback procedure. Produce a report of every unmet acceptance criterion from file 17. Do not mark the system as launch-ready; that sign-off belongs to the clinical, legal, security and privacy reviewers.
