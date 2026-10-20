# 03 — System Architecture

Clear separation between the user interface, backend services, AI reasoning, medical safety controls and external integrations.

## Layer diagram

```
Patient-facing Next.js application
  Symptom chat · Assessment results · Clinics · Medication info · Dashboard
            │
Next.js backend (Route Handlers + services)
  Authentication · Validation · Authorization · Rate limits · Audit logging
            │
 ┌──────────┼───────────────┬─────────────────┐
 │          │               │                 │
Safety    AI orchestration  MongoDB       External services
engine    (NVIDIA, schema,  (patients,    (maps, facility directory,
(rules,   validation)       consent,      emergency calling,
escalation)                 sessions,     clinical references)
                            assessments,
                            audit)
```

## Request flow for an assessment

1. Client sends message → route handler authenticates (or issues a guest session), validates with Zod, applies rate limit.
2. **Pre-AI safety check** (rule engine). If emergency → return emergency payload immediately.
3. AI orchestration builds the prompt, calls NVIDIA, parses and validates structured output.
4. **Post-AI safety gate** re-runs rules over the full conversation plus AI output; the stricter urgency wins.
5. Result persisted (if consented), audit event written, response returned.

## Recommended technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Forms and validation | React Hook Form, Zod |
| Backend | Next.js Route Handlers and server-side services |
| Database | MongoDB Atlas, Mongoose |
| AI inference | NVIDIA API Catalog / NIM-compatible inference API |
| Authentication | Auth.js or another secure provider |
| Maps | Google Maps Platform or Mapbox |
| Geolocation | Browser Geolocation API, with permission |
| Email | Resend or another transactional provider |
| File storage | S3-compatible private storage, only if required |
| Monitoring | Error tracking, metrics, security audit logs |
| Deployment | Vercel or another suitable host |

Use the latest compatible package versions and commit a lockfile.

## Recommended project structure

```
src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx
│   │   ├── about/page.tsx
│   │   └── emergency/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── verify-email/page.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── assessments/page.tsx
│   │   ├── history/page.tsx
│   │   ├── medications/page.tsx
│   │   ├── facilities/page.tsx
│   │   └── settings/page.tsx
│   ├── symptom-checker/page.tsx
│   ├── clinics/page.tsx
│   └── api/
│       ├── ai/assess/route.ts
│       ├── ai/chat/route.ts
│       ├── triage/route.ts
│       ├── facilities/route.ts
│       ├── emergency/route.ts
│       ├── assessments/route.ts
│       ├── patients/me/route.ts
│       └── webhooks/
├── components/
│   ├── ai-chat/
│   ├── assessment/
│   ├── emergency/
│   ├── facilities/
│   ├── dashboard/
│   └── ui/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── ai/
│   ├── safety/
│   ├── medical/
│   ├── maps/
│   ├── validation/
│   └── audit/
├── models/
├── services/
└── types/
```

This is a starting point. Do **not** put every business rule in a route handler: keep clinical rules, AI orchestration, database access and external integrations in separate services.

## Architectural rules

- Route handlers are thin: authenticate, validate, call a service, shape the response.
- `lib/safety` has no dependency on `lib/ai`. The safety engine must work with the AI completely offline.
- Emergency page (`/emergency`) is static and has no database or AI dependency.
- External providers sit behind interfaces (`MapsProvider`, `LlmProvider`) so they can be swapped.
