# 13 — Admin Panel and Clinical Governance

An admin interface is needed, but access to patient information must be tightly controlled.

## Admin modules

| Module | Scope |
|---|---|
| Overview and service health | Usage counts, inference failures, API latency, facility search errors, emergency-flow availability. Aggregate metrics; no patient details by default. |
| Clinical knowledge management | Reviewed references, approval status, provenance, review dates, supported jurisdictions |
| Safety rules and incidents | Versioned triage rules, reviewed incident reports, escalation workflows, ability to disable unsafe features |
| AI configuration and evaluation | Approved model IDs, prompt versions, test results, latency, failure rates, controlled rollout |
| User and access management | Account status, roles, consent status, access reviews; no unrestricted default access to medical conversations |

## Role-based access control

| Role | Access |
|---|---|
| Patient | Only their own permitted records |
| Support administrator | Account and technical support with limited health-data access |
| Clinical reviewer | Explicitly assigned clinical review tasks |
| System administrator | Infrastructure and configuration, **not** automatic access to patient records |
| Auditor / compliance reviewer | Narrowly scoped, logged access for authorized reviews |

A role name alone is not enough. Enforce authorization on every request and log sensitive access. Any clinician-facing workflow must verify the professional's credentials and authorization.

## Governance processes (new)

- **Rule change control:** a triage rule set can only become active after a clinical reviewer approves it; approvals are versioned and audited.
- **Incident workflow:** report → triage severity → clinical review → corrective action → rule/prompt update → post-incident review. Missed emergencies and false reassurance are the highest severity.
- **Break-glass access:** any access to an identifiable transcript requires a stated reason, time limit and audit entry.
- **Kill switches:** feature flags to disable the model, a rule set, medication module or facility search independently, effective within minutes.
- **Access reviews:** quarterly review of who holds each role.
