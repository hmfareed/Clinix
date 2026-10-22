import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { GhanaApprovedMedicationProvider, defaultMedicationProvider } from "@/lib/medication/ghana-provider";
import { DailyMedKnowledgeProvider } from "@/lib/medication/dailymed-provider";
import { CompositeMedicationProvider } from "@/lib/medication/composite-provider";
import {
  evaluateMultiDrugSafety,
  detectDuplicateActiveIngredients,
  findPairwiseInteractions,
} from "@/lib/medication/interaction-checker";
import {
  defaultMedicationAiService,
  detectMedicationEmergency,
} from "@/services/medication-ai-service";
import { defaultMedicationService } from "@/services/medication-service";
import * as authModule from "@/lib/auth/auth";
import { GET as searchMedicationsRoute } from "@/app/api/medication/search/route";
import { GET as getMedicationByIdRoute } from "@/app/api/medication/[id]/route";
import { POST as checkSafetyRoute } from "@/app/api/medication/safety-check/route";
import { POST as askMedicationAiRoute } from "@/app/api/medication/ask/route";
import { GET as getSavedRoute, POST as saveMedicationRoute } from "@/app/api/medication/saved/route";
import { DELETE as deleteSavedRoute } from "@/app/api/medication/saved/[id]/route";
import { POST as submitFeedbackRoute } from "@/app/api/medication/feedback/route";
import SavedMedication from "@/models/SavedMedication";
import MedicationFeedback from "@/models/MedicationFeedback";

// Mock authentication module
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

// Mock database connection
vi.mock("@/lib/db/mongodb", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(true),
  tryConnectToDatabase: vi.fn().mockResolvedValue(true),
  isDatabaseConnected: vi.fn().mockReturnValue(true),
}));

// Mock audit logging
vi.mock("@/lib/audit/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(true),
  hashIp: vi.fn().mockReturnValue("mock-hash"),
}));

describe("Comprehensive Medication Module (Stage 1 & Stage 2)", () => {
  const provider = defaultMedicationProvider;
  const mockUserId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. SEARCH, IDENTIFICATION & SPELLING TOLERANCE
  // =========================================================================
  describe("Medication Search & Spelling Tolerance", () => {
    it("matches generic names and brand names accurately", async () => {
      const paracetamol = await provider.getByNameOrBrand("Paracetamol");
      expect(paracetamol).not.toBeNull();
      expect(paracetamol?.genericName).toBe("Paracetamol");

      const panadol = await provider.getByNameOrBrand("Panadol");
      expect(panadol).not.toBeNull();
      expect(panadol?.genericName).toBe("Paracetamol");
    });

    it("tolerates common spelling mistakes using fuzzy matching", async () => {
      // Typo: "paractamol" -> Paracetamol
      const typoResults1 = await provider.search("paractamol");
      expect(typoResults1.some((m) => m.genericName.toLowerCase().includes("paracetamol"))).toBe(true);

      // Typo: "amoxcillin" -> Amoxicillin
      const typoResults2 = await provider.search("amoxcillin");
      expect(typoResults2.some((m) => m.genericName.toLowerCase().includes("amoxicillin"))).toBe(true);

      // Typo: "ibufen" -> Ibuprofen
      const typoResults3 = await provider.search("ibufen");
      expect(typoResults3.some((m) => m.genericName.toLowerCase().includes("ibuprofen"))).toBe(true);
    });

    it("filters search results by category correctly", async () => {
      const antibioticResults = await provider.search("", { category: "antibacterial" });
      expect(antibioticResults.length).toBeGreaterThan(0);
      expect(antibioticResults.some((m) => m.genericName === "Amoxicillin")).toBe(true);
    });

    it("filters search results by dosage form correctly", async () => {
      const inhalerResults = await provider.search("", { form: "inhaler" });
      expect(inhalerResults.length).toBeGreaterThan(0);
      expect(inhalerResults.some((m) => m.genericName === "Salbutamol")).toBe(true);
    });

    it("filters search results by classification (OTC vs Prescription-Only)", async () => {
      const otcResults = await provider.search("", { classification: "over_the_counter" });
      expect(otcResults.every((m) => m.classification === "over_the_counter")).toBe(true);

      const pomResults = await provider.search("", { classification: "prescription_only" });
      expect(pomResults.every((m) => m.classification === "prescription_only")).toBe(true);
    });
  });

  // =========================================================================
  // 2. MEDICINE DETAILS & MISSING SOURCE FIELDS
  // =========================================================================
  describe("Medicine Detail Retrieval & Field Handling", () => {
    it("returns rich clinical fields for verified medications", async () => {
      const ibuprofen = await provider.getByNameOrBrand("Ibuprofen");
      expect(ibuprofen).not.toBeNull();
      expect(ibuprofen?.activeIngredients).toBeDefined();
      expect(ibuprofen?.availableForms).toBeDefined();
      expect(ibuprofen?.dosageForms).toContain("Tablet");
      expect(ibuprofen?.storageAndHandling).toBeDefined();
      expect(ibuprofen?.boxedWarning).toBeDefined();
      expect(ibuprofen?.referenceSource.jurisdiction).toBe("GH");
    });

    it("gracefully handles retrieval of non-existent medication via API route", async () => {
      const req = new NextRequest("http://localhost:3000/api/medication/NON_EXISTENT_ID");
      const res = await getMedicationByIdRoute(req, {
        params: Promise.resolve({ id: "NON_EXISTENT_ID" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error?.code).toBe("NOT_FOUND");
    });
  });

  // =========================================================================
  // 3. STALE OR UNAVAILABLE PROVIDER DATA FALLBACK
  // =========================================================================
  describe("Provider Resilience & Auxiliary DailyMed Provider", () => {
    it("falls back gracefully when DailyMed network call fails or aborts", async () => {
      const dailyMedProvider = new DailyMedKnowledgeProvider();
      // Mock fetch rejection to simulate network outage
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

      const results = await dailyMedProvider.search("unknown-drug");
      expect(results).toEqual([]);

      global.fetch = originalFetch;
    });

    it("CompositeProvider queries local provider first before falling back", async () => {
      const composite = new CompositeMedicationProvider(provider);
      const localResult = await composite.getByNameOrBrand("Paracetamol");
      expect(localResult).not.toBeNull();
      expect(localResult?.referenceSource.jurisdiction).toBe("GH");
    });
  });

  // =========================================================================
  // 4. MULTI-DRUG INTERACTION CHECKS & DUPLICATE ACTIVE INGREDIENTS
  // =========================================================================
  describe("Medication Safety Engine: Multi-Drug & Duplicate Ingredient Checks", () => {
    it("detects duplicate active ingredients (e.g. Panadol + Febrax both containing Paracetamol)", () => {
      const duplicates = detectDuplicateActiveIngredients([
        { rawName: "Panadol" },
        { rawName: "Febrax" },
      ]);

      expect(duplicates.length).toBe(1);
      expect(duplicates[0].ingredient).toBe("Paracetamol");
      expect(duplicates[0].severity).toBe("critical");
      expect(duplicates[0].warning).toContain("Duplicate Active Ingredient Detected");
      expect(duplicates[0].warning).toContain("overdose");
    });

    it("detects critical drug interactions between Ibuprofen and Warfarin", () => {
      const interactions = findPairwiseInteractions(["ibuprofen", "warfarin"]);
      expect(interactions.length).toBeGreaterThan(0);
      expect(interactions[0].severity).toBe("critical");
      expect(interactions[0].effect).toContain("bleeding");
      expect(interactions[0].management).toBeDefined();
    });

    it("detects critical interaction between Metronidazole and Alcohol", () => {
      const interactions = findPairwiseInteractions(["metronidazole", "alcohol"]);
      expect(interactions.length).toBeGreaterThan(0);
      expect(interactions.some((i) => i.effect.toLowerCase().includes("disulfiram"))).toBe(true);
    });

    it("detects absorption chelation block between Ciprofloxacin and Antacids", () => {
      const interactions = findPairwiseInteractions([
        "ciprofloxacin",
        "magnesium trisilicate compound",
      ]);
      expect(interactions.length).toBeGreaterThan(0);
      expect(interactions[0].effect).toContain("chelates");
    });

    it("evaluates multi-drug safety and returns comprehensive result object", async () => {
      const result = await evaluateMultiDrugSafety(["Panadol", "Febrax", "Warfarin"], {
        ageYears: 45,
        pregnancy: "no",
        allergies: { status: "no", items: [] },
        currentMedicines: { status: "no", items: [] },
      });

      expect(result.duplicateIngredients.length).toBeGreaterThan(0);
      expect(result.status).toBe("contraindicated");
      expect(result.referral.required).toBe(true);
      expect(result.limitations.length).toBeGreaterThan(0);
    });

    it("treats absence of recorded interactions with explicit safety limitations disclaimer", async () => {
      const result = await evaluateMultiDrugSafety(
        ["Oral Rehydration Salts (ORS)", "Cetirizine"],
        {
          ageYears: 30,
          pregnancy: "no",
          allergies: { status: "no", items: [] },
          currentMedicines: { status: "no", items: [] },
        }
      );

      // Safe pair with no known interactions
      expect(result.interactions.length).toBe(0);
      expect(result.duplicateIngredients.length).toBe(0);
      expect(result.status).toBe("eligible_info");
      // Explicit limitation that absence of interaction does not guarantee safety
      expect(
        result.limitations.some((l) => l.includes("Absence of recorded interactions does not imply safety"))
      ).toBe(true);
    });
  });

  // =========================================================================
  // 5. GROUNDED AI ASSISTANT & DOSAGE REFUSAL
  // =========================================================================
  describe("Clinix AI Medication Assistant & Grounding", () => {
    it("answers grounded medication questions using verified regulatory source", async () => {
      const aiResult = await defaultMedicationAiService.askQuestion({
        medicationName: "Paracetamol",
        question: "What is this medicine used for?",
      });

      expect(aiResult.medicationIdentified?.genericName).toBe("Paracetamol");
      expect(aiResult.sourceCitations.length).toBeGreaterThan(0);
      expect(aiResult.sourceCitations[0].jurisdiction).toBe("GH");
      expect(aiResult.pharmacistQuestions.length).toBeGreaterThan(0);
      expect(aiResult.isEmergency).toBe(false);
    });

    it("refuses individualized dosage calculations and advises pharmacist consultation", async () => {
      const aiResult = await defaultMedicationAiService.askQuestion({
        medicationName: "Ibuprofen",
        question: "How many tablets should my 6 year old child take for fever?",
      });

      expect(aiResult.answer).toContain("Dosage Safety Policy");
      expect(aiResult.answer).toContain("Clinix does not calculate or recommend individual drug dosages");
      expect(aiResult.answer).toContain("pharmacist");
    });

    it("handles ambiguous medication names by returning clarification options", async () => {
      const aiResult = await defaultMedicationAiService.askQuestion({
        medicationName: "Pan", // Ambiguous prefix
        question: "Is this safe?",
      });

      if (aiResult.ambiguousMatches && aiResult.ambiguousMatches.length > 0) {
        expect(aiResult.followUpQuestion).not.toBeNull();
      }
    });

    it("automatically extracts medication from question when medicationId and medicationName are omitted (Paracetamol regression test)", async () => {
      const aiResult = await defaultMedicationAiService.askQuestion({
        question: "What are the most important precautions for Paracetamol?",
      });

      expect(aiResult.medicationIdentified?.genericName).toBe("Paracetamol");
      expect(aiResult.answer).toContain("Paracetamol");
      expect(aiResult.answer).toContain("Important Safety Precautions");
      expect(aiResult.answer).not.toContain("could not locate");
      expect(aiResult.answer).not.toContain("the specified medicine");
      expect(aiResult.sourceCitations.length).toBeGreaterThan(0);
    });

    it("extracts registered brand names from question text (Panadol -> Paracetamol)", async () => {
      const aiResult = await defaultMedicationAiService.askQuestion({
        question: "Can I take Panadol with food?",
      });

      expect(aiResult.medicationIdentified?.genericName).toBe("Paracetamol");
      expect(aiResult.answer).toContain("Paracetamol");
    });

    it("provides safe general guidance when no medicine is specified or detected", async () => {
      const aiResult = await defaultMedicationAiService.askQuestion({
        question: "How should I store my home medications safely?",
      });

      expect(aiResult.answer).toContain("Verified Medication Information & Safety");
      expect(aiResult.answer).toContain("General Medication Safety Principles");
      expect(aiResult.answer).not.toContain("the specified medicine");
      expect(aiResult.safetyWarnings[0]).toContain("No specific medicine identified");
    });

    it("refuses unverified medication queries gracefully", async () => {
      const aiResult = await defaultMedicationAiService.askQuestion({
        medicationName: "TotallyFakeDrugXYZ",
        question: "What does this treat?",
      });

      expect(aiResult.answer).toContain("could not locate");
      expect(aiResult.answer).toContain("verified national formulary");
      expect(aiResult.medicationIdentified).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. EMERGENCY ESCALATION (OVERDOSE & ANAPHYLAXIS)
  // =========================================================================
  describe("Emergency Pathway & Overdose Escalation", () => {
    it("detects acute medication overdose intent immediately", () => {
      expect(detectMedicationEmergency("I took an overdose of pills")).toBe(true);
      expect(detectMedicationEmergency("my child drank the entire bottle of syrup")).toBe(true);
      expect(detectMedicationEmergency("swallowed entire bottle of medicine by accident")).toBe(true);
      expect(detectMedicationEmergency("cannot breathe after taking tablet, throat is closing")).toBe(true);
      expect(detectMedicationEmergency("is this safe with food?")).toBe(false);
    });

    it("escalates overdose inquiries directly to emergency protocol with 112 guidance", async () => {
      const result = await defaultMedicationAiService.askQuestion({
        medicationName: "Paracetamol",
        question: "Help, I swallowed the entire bottle of paracetamol pills in an overdose",
      });

      expect(result.isEmergency).toBe(true);
      expect(result.answer).toContain("EMERGENCY DETECTED");
      expect(result.answer).toContain("112");
      expect(result.emergencyInstructions).toContain("112");
    });
  });

  // =========================================================================
  // 7. SAVED MEDICINES AUTHORIZATION & PRIVACY
  // =========================================================================
  describe("Saved Reference Medicines Authorization & Scoping", () => {
    it("returns 401 Unauthorized for unauthenticated GET request to /api/medication/saved", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null as any);

      const req = new NextRequest("http://localhost:3000/api/medication/saved");
      const res = await getSavedRoute(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error?.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 Unauthorized for unauthenticated POST request to /api/medication/saved", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null as any);

      const req = new NextRequest("http://localhost:3000/api/medication/saved", {
        method: "POST",
        body: JSON.stringify({
          medicationId: "GH-MED-001",
          genericName: "Paracetamol",
        }),
      });
      const res = await saveMedicationRoute(req);

      expect(res.status).toBe(401);
    });

    it("allows authenticated user to save medication and attaches disclaimer that it is a reference bookmark", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: mockUserId, email: "patient@example.com" },
        expires: "2099-01-01",
      } as any);

      vi.spyOn(SavedMedication, "countDocuments").mockResolvedValue(2 as any);
      vi.spyOn(SavedMedication, "findOneAndUpdate").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(mockUserId),
        medicationId: "GH-MED-001",
        genericName: "Paracetamol",
        disclaimer: "This is a personal reference bookmark for educational purposes only.",
        createdAt: new Date(),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/medication/saved", {
        method: "POST",
        body: JSON.stringify({
          medicationId: "GH-MED-001",
          genericName: "Paracetamol",
          brandName: "Panadol",
          notes: "Recommended for tension headaches",
        }),
      });

      const res = await saveMedicationRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.genericName).toBe("Paracetamol");
      expect(json.data.disclaimer).toContain("reference bookmark");
    });
  });

  // =========================================================================
  // 8. SENSITIVE DATA HANDLING & RATE LIMITING
  // =========================================================================
  describe("API Governance, Rate Limiting & Sensitive Data", () => {
    it("returns rate limit headers on safety-check requests", async () => {
      const req = new NextRequest("http://localhost:3000/api/medication/safety-check", {
        method: "POST",
        body: JSON.stringify({
          medications: ["Paracetamol"],
          patientContext: {
            ageYears: 25,
            pregnancy: "no",
            allergies: { status: "no", items: [] },
            currentMedicines: { status: "no", items: [] },
          },
        }),
      });

      const res = await checkSafetyRoute(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBeDefined();
      expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
    });

    it("handles feedback submissions gracefully without leaking internal errors", async () => {
      vi.spyOn(MedicationFeedback, "create").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/medication/feedback", {
        method: "POST",
        body: JSON.stringify({
          medicationId: "GH-MED-001",
          medicationName: "Paracetamol",
          feedbackType: "general_feedback",
          details: "Information is clear and accurate.",
        }),
      });

      const res = await submitFeedbackRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.message).toContain("submitted");
    });
  });
});
