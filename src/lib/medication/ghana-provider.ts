import { ApprovedMedication, IMedicationKnowledgeProvider } from "./types";
import bundledMedications from "@/data/ghana-medications.json";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MedicalReference } from "@/models/MedicalReference";

export class GhanaApprovedMedicationProvider implements IMedicationKnowledgeProvider {
  private fallbackData: ApprovedMedication[];

  constructor() {
    this.fallbackData = bundledMedications as ApprovedMedication[];
  }

  /**
   * Search approved medications by generic name, brand name, indication, or therapeutic class.
   */
  async search(query: string): Promise<ApprovedMedication[]> {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return [];

    // Attempt DB search with timeout race if available
    try {
      const dbPromise = (async () => {
        await connectToDatabase();
        const records = await MedicalReference.find({
          reviewStatus: "approved",
          $or: [
            { "medication.genericName": { $regex: cleanQuery, $options: "i" } },
            { "medication.brandNames": { $regex: cleanQuery, $options: "i" } },
            { "medication.therapeuticClass": { $regex: cleanQuery, $options: "i" } },
            { "medication.approvedIndications": { $regex: cleanQuery, $options: "i" } },
          ],
        }).lean();

        if (records && records.length > 0) {
          return records.map((r) => r.medication as ApprovedMedication);
        }
        return null;
      })();

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 500));
      const dbResult = await Promise.race([dbPromise, timeoutPromise]);
      if (dbResult && dbResult.length > 0) {
        return dbResult;
      }
    } catch {
      // Fall through to bundled fallback
    }

    // Bundled fallback search
    return this.fallbackData.filter((med) => {
      const genericMatch = med.genericName.toLowerCase().includes(cleanQuery);
      const brandMatch = med.brandNames.some((b) => b.toLowerCase().includes(cleanQuery));
      const classMatch = med.therapeuticClass.toLowerCase().includes(cleanQuery);
      const indicationMatch = med.approvedIndications.some((ind) =>
        ind.toLowerCase().includes(cleanQuery)
      );

      return genericMatch || brandMatch || classMatch || indicationMatch;
    });
  }

  /**
   * Retrieve by exact or normalized ID (e.g. "GH-MED-001")
   */
  async getById(id: string): Promise<ApprovedMedication | null> {
    const cleanId = id.trim().toUpperCase();

    // Check bundled data first for speed
    const bundled = this.fallbackData.find((m) => m.id.toUpperCase() === cleanId);
    if (bundled) return bundled;

    try {
      await connectToDatabase();
      const record = await MedicalReference.findOne({
        referenceId: cleanId,
        reviewStatus: "approved",
      }).lean();

      if (record?.medication) {
        return record.medication as ApprovedMedication;
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * Retrieve by active ingredient (generic name) or any registered brand name.
   */
  async getByNameOrBrand(name: string): Promise<ApprovedMedication | null> {
    const clean = name.toLowerCase().trim();
    if (!clean) return null;

    // Check bundled data first
    const directMatch = this.fallbackData.find(
      (m) =>
        m.genericName.toLowerCase() === clean ||
        m.brandNames.some((b) => b.toLowerCase() === clean)
    );
    if (directMatch) return directMatch;

    // Partial/fuzzy match in bundled data (e.g. "panadol extra" matches "panadol", "paracetamol 500" matches "paracetamol")
    const substringMatch = this.fallbackData.find(
      (m) =>
        clean.includes(m.genericName.toLowerCase()) ||
        m.genericName.toLowerCase().includes(clean) ||
        m.brandNames.some((b) => clean.includes(b.toLowerCase()) || b.toLowerCase().includes(clean))
    );
    if (substringMatch) return substringMatch;

    // Try DB query if not found
    try {
      await connectToDatabase();
      const record = await MedicalReference.findOne({
        reviewStatus: "approved",
        $or: [
          { "medication.genericName": { $regex: `^${clean}$`, $options: "i" } },
          { "medication.brandNames": { $regex: `^${clean}$`, $options: "i" } },
        ],
      }).lean();

      if (record?.medication) {
        return record.medication as ApprovedMedication;
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * Return all approved medications
   */
  async getAll(): Promise<ApprovedMedication[]> {
    return this.fallbackData;
  }
}

export const defaultMedicationProvider = new GhanaApprovedMedicationProvider();
