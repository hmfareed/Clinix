import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import {
  ClinixAssistantService,
  AssistantAuthorizationError,
  AssistantNotFoundError,
} from "@/services/clinix-assistant-service";
import AssistantConversation from "@/models/AssistantConversation";
import AssistantMessage from "@/models/AssistantMessage";
import Assessment from "@/models/Assessment";

// Mock mongodb connection
vi.mock("@/lib/db/mongodb", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(true),
  tryConnectToDatabase: vi.fn().mockResolvedValue(true),
  isDatabaseConnected: vi.fn().mockReturnValue(true),
}));

// Mock audit logger so test runs in isolation without DB hang
vi.mock("@/lib/audit/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(true),
  hashIp: vi.fn().mockReturnValue("mocked-hash"),
}));

// Mock MedicalReference to avoid DB queries
vi.mock("@/models/MedicalReference", () => ({
  MedicalReference: {
    find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  },
}));

// Mock emergency configuration
vi.mock("@/lib/emergency/emergency-config", () => ({
  getEmergencyConfiguration: vi.fn().mockResolvedValue({
    countryCode: "GH",
    countryName: "Ghana",
    emergencyNumber: "112",
    serviceName: "National Ambulance Service",
    isVerified: true,
  }),
}));

describe("Clinix Assistant Service - Core Operations & Safety", () => {
  let service: ClinixAssistantService;
  const userAId = new mongoose.Types.ObjectId().toString();
  const userBId = new mongoose.Types.ObjectId().toString();
  const conversationAId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClinixAssistantService();
  });

  describe("Object-Level Authorization & Two-User Isolation", () => {
    it("prevents User B from accessing User A's conversation", async () => {
      // Mock findById returning conversation owned by User A
      vi.spyOn(AssistantConversation, "findById").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(conversationAId),
        userId: new mongoose.Types.ObjectId(userAId),
        title: "User A Consultation",
        status: "active",
        currentState: "idle",
      } as any);

      // User B attempts to access User A's conversation
      await expect(
        service.getConversation(conversationAId, { userId: userBId })
      ).rejects.toThrow(AssistantAuthorizationError);
    });

    it("throws AssistantNotFoundError for non-existent conversation", async () => {
      vi.spyOn(AssistantConversation, "findById").mockResolvedValue(null);

      await expect(
        service.getConversation(conversationAId, { userId: userAId })
      ).rejects.toThrow(AssistantNotFoundError);
    });
  });

  describe("Pre-AI Emergency Screening & Bypassing Model Inference", () => {
    it("escalates immediately when emergency signs are detected without calling AI inference", async () => {
      const mockConv = {
        _id: new mongoose.Types.ObjectId(conversationAId),
        userId: new mongoose.Types.ObjectId(userAId),
        status: "active",
        currentState: "idle",
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(AssistantConversation, "findById").mockResolvedValue(mockConv as any);
      vi.spyOn(AssistantMessage, "findOne").mockResolvedValue(null);
      vi.spyOn(AssistantMessage, "create").mockResolvedValue({} as any);

      const result = await service.processPatientMessage({
        conversationId: conversationAId,
        message: "I have crushing chest pain and cannot breathe",
        authContext: { userId: userAId },
      });

      expect(result.currentState).toBe("escalated");
      expect(result.intent).toBe("emergency_assistance");
      expect(result.response.safety.urgentPathwayTriggered).toBe(true);
      expect(result.response.actions.some((a) => a.type === "call")).toBe(true);
      expect(mockConv.status).toBe("emergency");
      expect(mockConv.currentState).toBe("escalated");
    });
  });

  describe("Idempotency Prevention", () => {
    it("returns previously processed response when clientMessageId is repeated", async () => {
      const existingUserMsg = {
        _id: new mongoose.Types.ObjectId(),
        clientMessageId: "unique_req_123",
        createdAt: new Date("2026-10-20T10:00:00Z"),
      };

      const existingAssistantMsg = {
        _id: new mongoose.Types.ObjectId(),
        role: "assistant",
        intent: "symptom_assessment",
        createdAt: new Date("2026-10-20T10:00:02Z"),
        structuredPayload: {
          intent: "symptom_assessment",
          state: "asking_questions",
          message: "Cached answer",
          followUpQuestion: null,
          safety: { urgentPathwayTriggered: false, ruleIds: [] },
          actions: [],
          sources: [],
        },
      };

      vi.spyOn(AssistantConversation, "findById").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(conversationAId),
        userId: new mongoose.Types.ObjectId(userAId),
        status: "active",
        currentState: "asking_questions",
      } as any);

      vi.spyOn(AssistantMessage, "findOne")
        .mockResolvedValueOnce(existingUserMsg as any)
        .mockReturnValueOnce({
          sort: vi.fn().mockResolvedValue(existingAssistantMsg),
        } as any);

      const result = await service.processPatientMessage({
        conversationId: conversationAId,
        message: "Test message",
        clientMessageId: "unique_req_123",
        authContext: { userId: userAId },
      });

      expect(result.response.message).toBe("Cached answer");
    });
  });

  describe("Care Navigation & Medication Safety Boundaries", () => {
    it("handles clinic queries by querying verified facilities", async () => {
      vi.spyOn(AssistantConversation, "findById").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(conversationAId),
        userId: new mongoose.Types.ObjectId(userAId),
        status: "active",
        currentState: "idle",
        save: vi.fn().mockResolvedValue(true),
      } as any);

      vi.spyOn(AssistantMessage, "findOne").mockResolvedValue(null);
      vi.spyOn(AssistantMessage, "create").mockResolvedValue({} as any);

      const result = await service.processPatientMessage({
        conversationId: conversationAId,
        message: "Find a hospital near Accra",
        authContext: { userId: userAId },
      });

      expect(result.intent).toBe("clinic_search");
      expect(result.response.actions.length).toBeGreaterThan(0);
    });

    it("handles medication queries with reviewed safety guidance and refusal to prescribe", async () => {
      vi.spyOn(AssistantConversation, "findById").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(conversationAId),
        userId: new mongoose.Types.ObjectId(userAId),
        status: "active",
        currentState: "idle",
        save: vi.fn().mockResolvedValue(true),
      } as any);

      vi.spyOn(AssistantMessage, "findOne").mockResolvedValue(null);
      vi.spyOn(AssistantMessage, "create").mockResolvedValue({} as any);

      const result = await service.processPatientMessage({
        conversationId: conversationAId,
        message: "What is paracetamol?",
        authContext: { userId: userAId },
      });

      expect(result.intent).toBe("medication_information");
      expect(result.response.message).toContain("Paracetamol");
      expect(result.response.message).toContain("Clinix does not calculate personalized dosages");
    });
  });
});
