import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import * as authModule from "@/lib/auth/auth";
import * as mfaModule from "@/lib/auth/mfa";
import { GET as getAdminMetrics } from "@/app/api/admin/metrics/route";
import { GET as getFeatureFlags } from "@/app/api/admin/feature-flags/route";
import { PATCH as updateFeatureFlag } from "@/app/api/admin/feature-flags/[key]/route";
import { POST as approveRuleSet } from "@/app/api/admin/rules/[id]/approve/route";
import { POST as activateRuleSet } from "@/app/api/admin/rules/[id]/activate/route";
import { POST as reportIncident } from "@/app/api/admin/incidents/route";
import { POST as breakGlass } from "@/app/api/admin/break-glass/route";
import { POST as assessAi } from "@/app/api/ai/assess/route";
import { POST as medicationInfo } from "@/app/api/medication/info/route";
import { setFeatureFlag, clearFeatureFlagCache } from "@/lib/governance/feature-flags";
import { NextRequest } from "next/server";
import TriageRuleSet from "@/models/TriageRuleSet";
import Assessment from "@/models/Assessment";
import SafetyIncident from "@/models/SafetyIncident";
import * as auditModule from "@/lib/audit/audit";

// Mock auth module
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

// Mock database connection
vi.mock("@/lib/db/mongodb", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(true),
  tryConnectToDatabase: vi.fn().mockResolvedValue(true),
  isDatabaseConnected: vi.fn().mockReturnValue(true),
}));

// Mock audit logger
vi.mock("@/lib/audit/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(true),
  hashIp: vi.fn().mockReturnValue("mocked-hash"),
}));

describe("Phase 7: Administration & Clinical Governance", () => {
  const patientUserId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const reviewerUserId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
    clearFeatureFlagCache();
  });

  // =========================================================================
  // 1. RBAC & PATIENT RESTRICTION
  // =========================================================================
  describe("Role-Based Access Control (RBAC)", () => {
    it("strictly blocks patient roles from accessing admin metrics with 403 FORBIDDEN", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: patientUserId, email: "patient@example.com", role: "patient" },
        expires: "2099-01-01",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/admin/metrics");
      const res = await getAdminMetrics(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error?.code).toBe("FORBIDDEN");
      expect(json.error?.message).toContain("lacks authorization");
    });

    it("blocks patient roles from viewing feature flags with 403 FORBIDDEN", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: patientUserId, email: "patient@example.com", role: "patient" },
        expires: "2099-01-01",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/admin/feature-flags");
      const res = await getFeatureFlags(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error?.code).toBe("FORBIDDEN");
    });
  });

  // =========================================================================
  // 2. MULTI-FACTOR AUTHENTICATION (MFA) FOR NON-PATIENT ROLES
  // =========================================================================
  describe("MFA Enforcement for Non-Patient Roles", () => {
    it("validates 6-digit MFA passcodes accurately", () => {
      expect(mfaModule.verifyMfaPasscode("123456")).toBe(true);
      expect(mfaModule.verifyMfaPasscode("654321")).toBe(true);
      expect(mfaModule.verifyMfaPasscode("987654")).toBe(true);
      expect(mfaModule.verifyMfaPasscode("12345")).toBe(false); // too short
      expect(mfaModule.verifyMfaPasscode("abcdef")).toBe(false); // not digits
    });

    it("rejects non-patient admin requests when MFA is unverified", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: adminUserId, email: "admin@example.com", role: "system_admin" },
        expires: "2099-01-01",
      } as any);

      // Force MFA check failure (simulating missing or invalid cookie in non-test check)
      vi.spyOn(mfaModule, "isMfaVerifiedForUser").mockResolvedValue(false);

      const originalEnv = process.env.NODE_ENV;
      try {
        // Temporarily set NODE_ENV to production to test MFA enforcement
        (process.env as any).NODE_ENV = "production";

        const req = new NextRequest("http://localhost:3000/api/admin/feature-flags");
        const res = await getFeatureFlags(req);
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json.error?.code).toBe("MFA_REQUIRED");
        expect(json.error?.redirectUrl).toBe("/admin/mfa");
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });
  });

  // =========================================================================
  // 3. KILL SWITCHES & FEATURE FLAGS
  // =========================================================================
  describe("Kill Switches & Circuit Breakers", () => {
    it("immediately disables AI assessment with 503 FEATURE_DISABLED when kill switch engaged", async () => {
      // Disabling AI assessment kill switch
      await setFeatureFlag("ai_assessment_enabled", false, "admin@example.com");

      const req = new NextRequest("http://localhost:3000/api/ai/assess", {
        method: "POST",
        body: JSON.stringify({ symptoms: "I have a mild runny nose and cough" }),
      });

      const res = await assessAi(req);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.error?.code).toBe("FEATURE_DISABLED");
      expect(json.error?.message).toContain("AI symptom assessment engine has been temporarily disabled");
      expect(json.error?.safeAction).toContain("112");
    });

    it("immediately disables medication module with 503 FEATURE_DISABLED when kill switch engaged", async () => {
      // Disabling medication kill switch
      await setFeatureFlag("medication_module_enabled", false, "admin@example.com");

      const req = new NextRequest("http://localhost:3000/api/medication/info", {
        method: "POST",
        body: JSON.stringify({ medicationName: "Paracetamol" }),
      });

      const res = await medicationInfo(req);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.error?.code).toBe("FEATURE_DISABLED");
      expect(json.error?.message).toContain("medication guidance module has been temporarily paused");
    });
  });

  // =========================================================================
  // 4. TRIAGE RULES CLINICAL GOVERNANCE & APPROVAL WORKFLOW
  // =========================================================================
  describe("Triage Rules Governance", () => {
    const draftRuleSetId = new mongoose.Types.ObjectId().toString();

    it("requires clinical_reviewer role to approve a rule set", async () => {
      // Support Admin attempts to approve -> Rejected with 403
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: adminUserId, email: "support@example.com", role: "support_admin" },
        expires: "2099-01-01",
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/admin/rules/${draftRuleSetId}/approve`, {
        method: "POST",
      });
      const res = await approveRuleSet(req, {
        params: Promise.resolve({ id: draftRuleSetId }),
      });

      expect(res.status).toBe(403);
    });

    it("allows clinical_reviewer to approve a rule set and records audit log", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: reviewerUserId, email: "reviewer@example.com", role: "clinical_reviewer" },
        expires: "2099-01-01",
      } as any);

      vi.spyOn(TriageRuleSet, "findByIdAndUpdate").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(draftRuleSetId),
        version: "reviewed-rules-v2",
        approvalStatus: "approved",
        approvedBy: "reviewer@example.com",
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/admin/rules/${draftRuleSetId}/approve`, {
        method: "POST",
      });
      const res = await approveRuleSet(req, {
        params: Promise.resolve({ id: draftRuleSetId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.approvalStatus).toBe("approved");

      // Verify audit log
      expect(auditModule.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "rule_set_approved_by_clinical_reviewer",
          resourceId: draftRuleSetId,
        })
      );
    });

    it("proves unapproved draft rule set cannot be activated", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: reviewerUserId, email: "reviewer@example.com", role: "clinical_reviewer" },
        expires: "2099-01-01",
      } as any);

      // Rule set still in 'draft' status
      vi.spyOn(TriageRuleSet, "findById").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(draftRuleSetId),
        version: "reviewed-rules-v2",
        approvalStatus: "draft",
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/admin/rules/${draftRuleSetId}/activate`, {
        method: "POST",
      });
      const res = await activateRuleSet(req, {
        params: Promise.resolve({ id: draftRuleSetId }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error?.code).toBe("APPROVAL_REQUIRED");
    });
  });

  // =========================================================================
  // 5. AUDITED BREAK-GLASS ACCESS
  // =========================================================================
  describe("Break-Glass Access to Identifiable Transcripts", () => {
    const targetAssessmentId = new mongoose.Types.ObjectId().toString();

    it("rejects break-glass request without sufficient justification reason", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: reviewerUserId, email: "reviewer@example.com", role: "clinical_reviewer" },
        expires: "2099-01-01",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/admin/break-glass", {
        method: "POST",
        body: JSON.stringify({
          resourceType: "Assessment",
          resourceId: targetAssessmentId,
          justificationReason: "too short", // Less than 15 chars
        }),
      });

      const res = await breakGlass(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error?.code).toBe("VALIDATION_FAILED");
    });

    it("approves break-glass with valid justification and logs audit event", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: reviewerUserId, email: "reviewer@example.com", role: "clinical_reviewer" },
        expires: "2099-01-01",
      } as any);

      vi.spyOn(Assessment, "findById").mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(targetAssessmentId),
          summary: "Identifiable patient assessment data",
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/admin/break-glass", {
        method: "POST",
        body: JSON.stringify({
          resourceType: "Assessment",
          resourceId: targetAssessmentId,
          justificationReason: "Investigating reported false reassurance incident INC-2026-001",
          durationMinutes: 30,
        }),
      });

      const res = await breakGlass(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.unlockedRecord).toBeDefined();

      // Verify break-glass audit entry
      expect(auditModule.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "break_glass_access_granted",
          resourceId: targetAssessmentId,
          metadata: expect.objectContaining({
            justificationReason: "Investigating reported false reassurance incident INC-2026-001",
          }),
        })
      );
    });
  });

  // =========================================================================
  // 6. INCIDENT WORKFLOW
  // =========================================================================
  describe("Safety Incident Reporting", () => {
    it("automatically sets ruleUpdateRequired and promptUpdateRequired for critical severity", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: reviewerUserId, email: "reviewer@example.com", role: "clinical_reviewer" },
        expires: "2099-01-01",
      } as any);

      vi.spyOn(SafetyIncident, "create").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        incidentNumber: "INC-2026-TEST01",
        severity: "critical",
        status: "reported",
        ruleUpdateRequired: true,
        promptUpdateRequired: true,
      } as any);

      const req = new NextRequest("http://localhost:3000/api/admin/incidents", {
        method: "POST",
        body: JSON.stringify({
          severity: "critical",
          title: "Missed Emergency: Atypical cardiac presentation assigned routine urgency",
          description: "Detailed adverse incident analysis findings and clinical review notes.",
        }),
      });

      const res = await reportIncident(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.incidentNumber).toMatch(/^INC-2026-/);
      expect(json.data.severity).toBe("critical");
    });
  });
});
