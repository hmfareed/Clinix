import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import Assessment from "@/models/Assessment";
import Reminder from "@/models/Reminder";
import PatientProfile from "@/models/PatientProfile";
import User from "@/models/User";
import * as authModule from "@/lib/auth/auth";
import { GET as getAssessmentById, DELETE as deleteAssessmentById } from "@/app/api/assessments/[id]/route";
import { PATCH as updateReminderById, DELETE as deleteReminderById } from "@/app/api/reminders/[id]/route";
import { NextRequest } from "next/server";

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

// Mock audit logger so test runs in isolation
vi.mock("@/lib/audit/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(true),
  hashIp: vi.fn().mockReturnValue("mocked-hash"),
}));

describe("Phase 6: Patient Dashboard & Authorization Invariants", () => {
  const userAId = new mongoose.Types.ObjectId().toString();
  const userBId = new mongoose.Types.ObjectId().toString();
  const assessmentAId = new mongoose.Types.ObjectId().toString();
  const reminderAId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. OBJECT-LEVEL AUTHORIZATION & IDOR PREVENTION (TWO-USER TEST)
  // =========================================================================
  describe("Object-Level Authorization & IDOR Protection", () => {
    it("proves User B cannot read User A's assessment by changing the ID in the URL", async () => {
      // User B is authenticated
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: userBId, email: "user_b@example.com" },
        expires: "2099-01-01",
      } as any);

      // Spy on Assessment.findOne to simulate MongoDB query with strict scoping { _id, patientId }
      const findOneSpy = vi.spyOn(Assessment, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null), // returns null because patientId !== userBId
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/assessments/${assessmentAId}`);
      const res = await getAssessmentById(req, {
        params: Promise.resolve({ id: assessmentAId }),
      });

      const body = await res.json();

      // Verify that findOne was scoped by User B's ID, not User A's ID
      expect(findOneSpy).toHaveBeenCalledWith({
        _id: assessmentAId,
        patientId: userBId,
      });

      // Verify 404 response to prevent ID enumeration
      expect(res.status).toBe(404);
      expect(body.error?.code).toBe("NOT_FOUND");
      expect(body.error?.message).toContain("Assessment not found or inaccessible");
    });

    it("allows User A to read their own assessment and includes AI unverified disclaimer", async () => {
      // User A is authenticated
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: userAId, email: "user_a@example.com" },
        expires: "2099-01-01",
      } as any);

      const mockAssessment = {
        _id: new mongoose.Types.ObjectId(assessmentAId),
        patientId: new mongoose.Types.ObjectId(userAId),
        urgency: "urgent",
        summary: "Patient reported acute high fever and rigors.",
        symptoms: [{ description: "High fever" }],
        possibleConditions: [],
        recommendations: ["Visit a clinic promptly"],
        limitations: ["Not a confirmed diagnosis"],
        createdAt: new Date(),
      };

      vi.spyOn(Assessment, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockAssessment),
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/assessments/${assessmentAId}`);
      const res = await getAssessmentById(req, {
        params: Promise.resolve({ id: assessmentAId }),
      });

      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(assessmentAId);
      expect(body.data.isUnverifiedAI).toBe(true);
      expect(body.data.disclaimerNotice).toContain("AI-GENERATED AND UNVERIFIED BY A CLINICIAN");
    });

    it("proves User B cannot delete User A's assessment by ID", async () => {
      // User B attempts to delete User A's record
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: userBId, email: "user_b@example.com" },
        expires: "2099-01-01",
      } as any);

      const deleteSpy = vi.spyOn(Assessment, "findOneAndDelete").mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/assessments/${assessmentAId}`, {
        method: "DELETE",
      });
      const res = await deleteAssessmentById(req, {
        params: Promise.resolve({ id: assessmentAId }),
      });

      expect(deleteSpy).toHaveBeenCalledWith({
        _id: assessmentAId,
        patientId: userBId,
      });

      expect(res.status).toBe(404);
    });

    it("proves User B cannot modify or delete User A's reminder", async () => {
      // User B attempts to complete User A's reminder
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: userBId, email: "user_b@example.com" },
        expires: "2099-01-01",
      } as any);

      const updateSpy = vi.spyOn(Reminder, "findOneAndUpdate").mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/reminders/${reminderAId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
      const res = await updateReminderById(req, {
        params: Promise.resolve({ id: reminderAId }),
      });

      expect(updateSpy).toHaveBeenCalledWith(
        { _id: reminderAId, patientId: userBId },
        expect.anything(),
        expect.anything()
      );

      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated requests with 401 UNAUTHENTICATED", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null as any);

      const req = new NextRequest(`http://localhost:3000/api/assessments/${assessmentAId}`);
      const res = await getAssessmentById(req, {
        params: Promise.resolve({ id: assessmentAId }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error?.code).toBe("UNAUTHENTICATED");
    });
  });

  // =========================================================================
  // 2. HEALTH PROFILE TRI-STATE CONSTRAINTS
  // =========================================================================
  describe("Health Profile Tri-State Model", () => {
    it("ensures unknown clinical status is explicitly supported and preserved", () => {
      const profile = new PatientProfile({
        userId: new mongoose.Types.ObjectId(userAId),
        allergies: { status: "unknown", items: [] },
        currentMedicines: { status: "unknown", items: [] },
        pregnancy: "unknown",
      });

      expect(profile.allergies.status).toBe("unknown");
      expect(profile.currentMedicines.status).toBe("unknown");
      expect(profile.pregnancy).toBe("unknown");
    });

    it("supports documented allergies when status is yes", () => {
      const profile = new PatientProfile({
        userId: new mongoose.Types.ObjectId(userAId),
        ageYears: 34,
        allergies: { status: "yes", items: ["Penicillin", "Amoxicillin"] },
        currentMedicines: { status: "no", items: [] },
        pregnancy: "not_applicable",
      });

      expect(profile.allergies.status).toBe("yes");
      expect(profile.allergies.items).toContain("Penicillin");
      expect(profile.pregnancy).toBe("not_applicable");
    });
  });

  // =========================================================================
  // 3. AI UNVERIFIED LABELS EVERYWHERE
  // =========================================================================
  describe("AI-Generated and Unverified Assessment Labeling", () => {
    it("mandates disclaimer in assessment exports", () => {
      const exportNotice =
        "AI-GENERATED AND UNVERIFIED BY A CLINICIAN. Clinix is an automated informational assessment platform. These summaries reflect patient-reported symptoms and algorithmic outputs, and are NOT verified medical diagnoses or prescriptions.";

      expect(exportNotice.toLowerCase()).toContain("ai-generated");
      expect(exportNotice.toLowerCase()).toContain("unverified");
      expect(exportNotice.toLowerCase()).toContain("not verified medical diagnoses");
    });
  });
});
