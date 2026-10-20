# 18 — Deployment and Production Readiness

## Environments

Separate **local development**, **testing/staging** and **production**, each with its own database credentials and API secrets. Never test with real patient data unless the environment and process are specifically approved.

## Deployment checklist

- [ ] Environment variables configured in the hosting provider
- [ ] MongoDB provisioned with least-privilege credentials
- [ ] Allowed origins, auth callbacks and HTTPS configured
- [ ] Database indexes and schema validation applied
- [ ] Rate limits and request timeouts configured
- [ ] NVIDIA model availability and limits verified
- [ ] Emergency numbers and facility data sources verified
- [ ] Monitoring configured without logging sensitive health content
- [ ] Backups and restoration tested
- [ ] Security review conducted
- [ ] Clinical validation and legal review completed
- [ ] Incident response and feature-disable procedures documented
- [ ] Controlled rollout with monitoring

Vercel can host a Next.js app, but check hosting, database and AI providers' data-processing arrangements, residency requirements and operational limits before using them for real patient information.

## Additions (new)

- **CI/CD:** lint, type-check, unit tests, rule-engine suite, build, dependency audit, secret scan; deploy only from a protected branch.
- **Rollout:** internal → clinician pilot → small invited cohort → wider launch, each gated by metrics and incident review.
- **Observability dashboards:** assessment latency, AI failure rate, emergency-path availability, facility-search error rate, rate-limit hits.
- **Alerts:** emergency page unavailable, AI error rate above threshold, rule set failed to load.
- **Rollback:** every release is reversible; prompt, model and rule-set versions can roll back independently via feature flags.
- **Disaster recovery:** documented RPO/RTO, restore drill at least quarterly.
