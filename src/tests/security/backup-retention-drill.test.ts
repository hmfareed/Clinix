import { describe, it, expect, vi, beforeEach } from "vitest";
import { runBackupIntegrityDrill } from "../../../scripts/verify-backup-integrity";
import { User } from "../../models/User";
import { PatientProfile } from "../../models/PatientProfile";
import { Reminder } from "../../models/Reminder";
import { AuditEvent } from "../../models/AuditEvent";
import { TriageRuleSet } from "../../models/TriageRuleSet";
import mongoose from "mongoose";

describe("Phase 8: Disaster Recovery & Data Retention Verification Drill", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fails gracefully and reports error when database connection URI is absent", async () => {
    const result = await runBackupIntegrityDrill("");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("No connection URI provided");
    expect(result.indexesVerified).toBe(false);
  });

  it("verifies retention compliance and audit privacy in simulated restored database", async () => {
    // Mock counts
    vi.spyOn(User, "countDocuments").mockResolvedValue(100 as any);
    vi.spyOn(PatientProfile, "countDocuments").mockResolvedValue(100 as any);
    vi.spyOn(Reminder, "countDocuments").mockResolvedValue(20 as any);

    // Mock profiles and users
    const mockId = new mongoose.Types.ObjectId();
    vi.spyOn(PatientProfile, "find").mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { userId: mockId },
        { userId: mockId },
      ]),
    } as any);
    vi.spyOn(User, "exists").mockResolvedValue({ _id: mockId } as any);

    // Mock audit logs (sanitized without transcript content)
    vi.spyOn(AuditEvent, "find").mockReturnValue({
      limit: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            action: "user_login",
            metadata: { ip: "127.0.0.1", userAgent: "Mozilla" },
          },
          {
            action: "break_glass_access_granted",
            metadata: { justification: "Emergency investigation for ticket #402" },
          },
        ]),
      }),
    } as any);

    vi.spyOn(TriageRuleSet, "countDocuments").mockResolvedValue(1 as any);

    const result = await runBackupIntegrityDrill("mongodb://mock-restored-cluster:27017/clinix", {
      skipDbConnect: true,
    });

    expect(result.indexesVerified).toBe(true);
    expect(result.retentionComplianceVerified).toBe(true);
    expect(result.governanceRulesVerified).toBe(true);
    expect(result.summary.orphanedProfiles).toBe(0);
    expect(result.summary.auditLogViolations).toBe(0);
    expect(result.summary.activeRuleSets).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("flags violation when restored database contains unpurged orphaned profiles or leaked transcripts", async () => {
    vi.spyOn(User, "countDocuments").mockResolvedValue(50 as any);
    vi.spyOn(PatientProfile, "countDocuments").mockResolvedValue(50 as any);
    vi.spyOn(Reminder, "countDocuments").mockResolvedValue(10 as any);

    // Mock an orphaned profile whose parent user was deleted
    vi.spyOn(PatientProfile, "find").mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { userId: new mongoose.Types.ObjectId() },
      ]),
    } as any);
    vi.spyOn(User, "exists").mockResolvedValue(null); // User does NOT exist!

    // Mock audit log with transcript leak
    vi.spyOn(AuditEvent, "find").mockReturnValue({
      limit: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            action: "triage_completed",
            metadata: {
              transcript: "Patient complained of severe chest pain and breathlessness",
            },
          },
        ]),
      }),
    } as any);

    vi.spyOn(TriageRuleSet, "countDocuments").mockResolvedValue(0 as any);

    const result = await runBackupIntegrityDrill("mongodb://mock-restored-cluster:27017/clinix", {
      skipDbConnect: true,
    });

    expect(result.retentionComplianceVerified).toBe(false);
    expect(result.summary.orphanedProfiles).toBe(1);
    expect(result.summary.auditLogViolations).toBe(1);
    expect(result.errors.some((e) => e.includes("orphaned patient profiles"))).toBe(true);
    expect(result.errors.some((e) => e.includes("suspected health transcripts"))).toBe(true);
  });
});
