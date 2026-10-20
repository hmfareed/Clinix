# Backup and Restore Disaster Recovery Drill SOP

## 1. Objectives & Metrics

Per **Section 18 (Deployment and Production Readiness)** and **Section 24 (Data Retention and Consent)**:

| Metric | Target | Description |
|---|---|---|
| **RPO (Recovery Point Objective)** | **≤ 1 Hour** | Maximum acceptable data loss window, achieved via MongoDB Atlas continuous cloud backups and oplog streaming. |
| **RTO (Recovery Time Objective)** | **≤ 30 Minutes** | Time from disaster declaration to restored service availability on an isolated cluster. |
| **Drill Frequency** | **Quarterly** | Required disaster recovery rehearsal conducted by DevOps/Site Reliability and Clinical Governance. |

---

## 2. Backup Architecture

1. **Continuous Backup:**
   - MongoDB Atlas continuous oplog streaming enabled.
   - Point-in-Time Recovery (PITR) with 1-minute granularity over a 7-day rolling window.
2. **Scheduled Snapshots:**
   - Daily snapshots retained for 30 days.
   - Weekly snapshots retained for 90 days.
   - Encrypted at rest using AES-256 (customer-managed or provider keys).
3. **Rolling Window & Right to Erasure:**
   - Per Act 843 and Section 24, all snapshots naturally age out after the rolling retention window.
   - In the event of a point-in-time restore, the post-restore re-synchronization job must re-apply pending account deletions to prevent resurrecting purged patient data.

---

## 3. Step-by-Step Restoration Drill Procedure

### Step 3.1: Trigger and Target Cluster Provisioning
1. Identify target restore timestamp $T_{\text{target}}$ (e.g. 15 minutes prior to simulated incident).
2. Create an isolated staging/drill cluster (e.g., `clinix-restore-drill-stage`). **NEVER restore directly over production.**
3. In MongoDB Atlas Console or CLI:
   ```bash
   atlas backups restores start pointInTime \
     --clusterName clinix-prod \
     --targetClusterName clinix-restore-drill-stage \
     --pointInTimeUtc 2026-10-20T10:00:00Z
   ```

### Step 3.2: Network & Connection Configuration
1. Restrict IP access list on the restored cluster exclusively to the verification runner IP.
2. Generate temporary least-privilege credentials for the verification runner.
3. Configure `RESTORED_MONGODB_URI` environment variable.

### Step 3.3: Integrity & Retention Drill Verification
Execute the verification drill script:
```bash
npx tsx scripts/verify-backup-integrity.ts
```

The script verifies:
1. **Schema and Index Presence:**
   - `User` collection indexes (`email_1`).
   - `FacilityCache` 2dsphere spatial index (`location_2dsphere`).
   - `TriageRuleSet` version and status indexes.
   - Guest session TTL indexes (`createdAt_1` with expireAfterSeconds: 86400).
2. **Data Retention & Privacy Compliance:**
   - No active accounts with status `pending_deletion` beyond grace period.
   - No orphaned `PatientProfile` or `Reminder` records without a valid parent `User`.
   - Zero raw assessment chat messages or symptom text in `AuditEvent` records.
   - No unhashed passwords (`password` fields must be bcrypt hashes with work factor ≥ 12).
3. **Clinical Governance Verification:**
   - At least one active, approved `TriageRuleSet` exists.
   - System emergency fallback configurations are populated.

### Step 3.4: DNS / Routing Switchover (In Genuine Disaster)
1. Verify application health check (`GET /api/health`) against restored cluster returns `status: "ok"`.
2. Update Vercel / Kubernetes production secret `MONGODB_URI` to point to the validated cluster.
3. Trigger rolling deployment.
4. Verify end-to-end functionality (emergency dialer, symptom triage, care navigation).

---

## 4. Post-Drill Sign-Off & Audit Log
- Record completion timestamp, achieved RTO, achieved RPO, and any anomalies.
- Clinical Director and Security Lead review and file the DR drill certificate.
- Destroy the temporary drill cluster.
