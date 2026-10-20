import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import * as authModule from "@/lib/auth/auth";
import { POST as createConversation, GET as listConversations } from "@/app/api/v1/assistant/conversations/route";
import { GET as getConversationById } from "@/app/api/v1/assistant/conversations/[id]/route";
import { POST as postMessage } from "@/app/api/v1/assistant/conversations/[id]/messages/route";
import { POST as finishConversation } from "@/app/api/v1/assistant/conversations/[id]/finish/route";
import { POST as submitFeedback } from "@/app/api/v1/assistant/feedback/route";
import AssistantConversation from "@/models/AssistantConversation";
import AssistantMessage from "@/models/AssistantMessage";
import AssistantFeedback from "@/models/AssistantFeedback";

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db/mongodb", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/audit/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(true),
}));

describe("Assistant API Endpoints (/api/v1/assistant)", () => {
  const userAId = new mongoose.Types.ObjectId().toString();
  const userBId = new mongoose.Types.ObjectId().toString();
  const convAId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST & GET /api/v1/assistant/conversations", () => {
    it("creates a new conversation for authenticated user", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: userAId, email: "user_a@example.com" },
        expires: "2099-01-01",
      } as any);

      vi.spyOn(AssistantConversation, "create").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(convAId),
        userId: new mongoose.Types.ObjectId(userAId),
        title: "Health Inquiry",
        status: "active",
        currentState: "idle",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/v1/assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Health Inquiry" }),
      });

      const res = await createConversation(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(convAId);
    });

    it("lists authorized conversations for the authenticated user", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: userAId, email: "user_a@example.com" },
        expires: "2099-01-01",
      } as any);

      vi.spyOn(AssistantConversation, "find").mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              {
                _id: new mongoose.Types.ObjectId(convAId),
                title: "Inquiry 1",
                status: "active",
                currentState: "idle",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/v1/assistant/conversations");
      const res = await listConversations(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
    });
  });

  describe("GET /api/v1/assistant/conversations/:id", () => {
    it("returns 403 Forbidden when User B attempts to access User A's conversation", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: userBId, email: "user_b@example.com" },
        expires: "2099-01-01",
      } as any);

      vi.spyOn(AssistantConversation, "findById").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(convAId),
        userId: new mongoose.Types.ObjectId(userAId),
        title: "User A Consultation",
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/v1/assistant/conversations/${convAId}`);
      const res = await getConversationById(req, {
        params: Promise.resolve({ id: convAId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/v1/assistant/feedback", () => {
    it("records user feedback safely with validated ratings", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: userAId, email: "user_a@example.com" },
        expires: "2099-01-01",
      } as any);

      vi.spyOn(AssistantFeedback, "create").mockResolvedValue({} as any);

      const req = new NextRequest("http://localhost:3000/api/v1/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convAId,
          rating: "helpful",
          feedbackText: "Very clear explanation",
        }),
      });

      const res = await submitFeedback(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
    });
  });
});
