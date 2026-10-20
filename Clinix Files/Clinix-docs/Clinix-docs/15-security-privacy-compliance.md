# 15 — Security, Privacy and Compliance

One of the most important sections of the project.

## Legal context

For a Ghana-focused deployment, review the **Data Protection Act, 2012 (Act 843)**, the Data Protection Commission's requirements (including controller/processor obligations and registration), and any applicable health-sector rules. Evaluate requirements for every other country you intend to serve.

## Minimum security requirements

- HTTPS throughout
- Secure password hashing via a trusted auth implementation
- Protected sessions, CSRF protection where applicable, rate limiting
- Strict server-side input validation
- Object-level authorization for every patient resource
- API keys only in server-side environment variables or a secret manager
- Encryption at rest and in transit
- Minimal retention of patient transcripts
- Controlled, audited access to medical information
- Data export, correction and deletion workflows
- Dependency scanning and regular security reviews
- Backups and recovery tests
- Incident response and breach notification procedures
- No medical data in analytics, ordinary console logs or error reports
- Explicit disclosure of what data goes to NVIDIA and other processors
- Review of provider retention, training, residency and contractual terms before sending sensitive information

Do not assume an AI API is suitable for healthcare data simply because it is available. Verify the exact service terms, data handling and compliance arrangements for the endpoint you use.

WHO's guidance on large multimodal models should be reviewed before introducing images, voice, audio or other modalities.

## Additional controls (new)

| Area | Control |
|---|---|
| Headers | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame protections |
| Prompt injection | Treat all patient text as untrusted; system prompt isolated; model has no tools beyond narrow validated functions; outputs schema-validated |
| Logging | Structured logs with `requestId`; redaction middleware; transcripts never logged |
| Secrets | Rotation schedule; separate keys per environment; secret scanning in CI |
| Database | Field-level encryption considered for allergies, medicines and message content |
| Admin | MFA required for every non-patient role |
| Supply chain | Lockfile committed, automated dependency updates, `npm audit` in CI |
| Abuse | Rate limits per IP and per account; bot protection on guest endpoints |
| Breach response | Documented runbook, notification timelines per Act 843 and the DPC |

## Privacy checklist

- [ ] Privacy notice written in plain language
- [ ] Consent captured with policy version and timestamp
- [ ] Data map of what goes to which processor
- [ ] Data-processing agreements reviewed
- [ ] Retention periods approved (see [24](24-data-retention-and-consent.md))
- [ ] Export and deletion tested end to end
- [ ] Data protection impact assessment completed
- [ ] Controller registration with the Data Protection Commission confirmed
