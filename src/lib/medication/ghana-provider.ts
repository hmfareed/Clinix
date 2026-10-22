import {
  ApprovedMedication,
  IMedicationKnowledgeProvider,
  MedicationSearchOptions,
} from "./types";
import bundledMedications from "@/data/ghana-medications.json";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MedicalReference } from "@/models/MedicalReference";

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function isFuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (q === t) return true;
  if (t.includes(q) || q.includes(t)) return true;

  // For words with at least 4 letters, allow edit distance <= 2
  if (q.length >= 4 && t.length >= 4) {
    const dist = levenshteinDistance(q, t);
    if (dist <= 2) return true;
  }

  // Check word-by-word
  const targetWords = t.split(/\s+/);
  for (const word of targetWords) {
    if (word.length >= 4 && q.length >= 4) {
      if (levenshteinDistance(q, word) <= 2) return true;
    }
  }

  return false;
}

export class GhanaApprovedMedicationProvider implements IMedicationKnowledgeProvider {
  private fallbackData: ApprovedMedication[];

  constructor() {
    this.fallbackData = bundledMedications as ApprovedMedication[];
  }

  /**
   * Search approved medications with spelling tolerance and category/form filters.
   */
  async search(
    query: string,
    options?: MedicationSearchOptions
  ): Promise<ApprovedMedication[]> {
    const cleanQuery = query.toLowerCase().trim();

    let pool = this.fallbackData;

    // Attempt DB search with timeout race if available
    try {
      const dbPromise = (async () => {
        await connectToDatabase();
        const records = await MedicalReference.find({
          reviewStatus: "approved",
        }).lean();

        if (records && records.length > 0) {
          return records.map((r) => r.medication as ApprovedMedication);
        }
        return null;
      })();

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 400));
      const dbResult = await Promise.race([dbPromise, timeoutPromise]);
      if (dbResult && dbResult.length > 0) {
        pool = dbResult;
      }
    } catch {
      // Fall through to bundled fallback
    }

    let results = pool;

    // Apply query matching (with exact, substring, and fuzzy matching)
    if (cleanQuery) {
      results = results.filter((med) => {
        const genericMatch =
          med.genericName.toLowerCase().includes(cleanQuery) ||
          isFuzzyMatch(cleanQuery, med.genericName);

        const brandMatch = med.brandNames.some(
          (b) => b.toLowerCase().includes(cleanQuery) || isFuzzyMatch(cleanQuery, b)
        );

        const classMatch = med.therapeuticClass.toLowerCase().includes(cleanQuery);

        const indicationMatch = med.approvedIndications.some((ind) =>
          ind.toLowerCase().includes(cleanQuery)
        );

        const ingredientMatch = med.activeIngredients?.some(
          (ai) =>
            ai.name.toLowerCase().includes(cleanQuery) || isFuzzyMatch(cleanQuery, ai.name)
        );

        return genericMatch || brandMatch || classMatch || indicationMatch || ingredientMatch;
      });
    }

    // Apply classification filter
    if (options?.classification) {
      results = results.filter((m) => m.classification === options.classification);
    }

    // Apply category filter
    if (options?.category && options.category !== "all") {
      const cat = options.category.toLowerCase();
      results = results.filter((m) => {
        const thClass = m.therapeuticClass.toLowerCase();
        const indications = m.approvedIndications.join(" ").toLowerCase();
        return thClass.includes(cat) || indications.includes(cat);
      });
    }

    // Apply form filter
    if (options?.form && options.form !== "all") {
      const formFilter = options.form.toLowerCase();
      results = results.filter((m) => {
        const forms = (m.dosageForms || []).map((f) => f.toLowerCase());
        const available = (m.availableForms || []).map((af) => af.form.toLowerCase());
        return forms.some((f) => f.includes(formFilter)) || available.some((a) => a.includes(formFilter));
      });
    }

    // Sort by relevance (exact match on generic or brand first)
    if (cleanQuery) {
      results.sort((a, b) => {
        const aExactGeneric = a.genericName.toLowerCase() === cleanQuery ? 1 : 0;
        const bExactGeneric = b.genericName.toLowerCase() === cleanQuery ? 1 : 0;
        if (aExactGeneric !== bExactGeneric) return bExactGeneric - aExactGeneric;

        const aExactBrand = a.brandNames.some((bn) => bn.toLowerCase() === cleanQuery) ? 1 : 0;
        const bExactBrand = b.brandNames.some((bn) => bn.toLowerCase() === cleanQuery) ? 1 : 0;
        return bExactBrand - aExactBrand;
      });
    }

    if (options?.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
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
      const dbPromise = (async () => {
        await connectToDatabase();
        const record = await MedicalReference.findOne({
          referenceId: cleanId,
          reviewStatus: "approved",
        }).lean();
        return record?.medication ? (record.medication as ApprovedMedication) : null;
      })();

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 300));
      const dbResult = await Promise.race([dbPromise, timeoutPromise]);
      if (dbResult) return dbResult;
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

    // 1. Direct exact match in bundled data
    const directMatch = this.fallbackData.find(
      (m) =>
        m.genericName.toLowerCase() === clean ||
        m.brandNames.some((b) => b.toLowerCase() === clean)
    );
    if (directMatch) return directMatch;

    // 2. Partial/fuzzy match in bundled data
    const substringMatch = this.fallbackData.find(
      (m) =>
        clean.includes(m.genericName.toLowerCase()) ||
        m.genericName.toLowerCase().includes(clean) ||
        m.brandNames.some((b) => clean.includes(b.toLowerCase()) || b.toLowerCase().includes(clean)) ||
        isFuzzyMatch(clean, m.genericName) ||
        m.brandNames.some((b) => isFuzzyMatch(clean, b))
    );
    if (substringMatch) return substringMatch;

    // 3. Try DB query if not found
    try {
      const dbPromise = (async () => {
        await connectToDatabase();
        const record = await MedicalReference.findOne({
          reviewStatus: "approved",
          $or: [
            { "medication.genericName": { $regex: `^${clean}$`, $options: "i" } },
            { "medication.brandNames": { $regex: `^${clean}$`, $options: "i" } },
          ],
        }).lean();
        return record?.medication ? (record.medication as ApprovedMedication) : null;
      })();

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 300));
      const dbResult = await Promise.race([dbPromise, timeoutPromise]);
      if (dbResult) return dbResult;
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
