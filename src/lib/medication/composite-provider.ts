import {
  ApprovedMedication,
  IMedicationKnowledgeProvider,
  MedicationSearchOptions,
} from "./types";
import { GhanaApprovedMedicationProvider, defaultMedicationProvider } from "./ghana-provider";
import { DailyMedKnowledgeProvider, defaultDailyMedProvider } from "./dailymed-provider";

export class CompositeMedicationProvider implements IMedicationKnowledgeProvider {
  private localProvider: GhanaApprovedMedicationProvider;
  private dailyMedProvider: DailyMedKnowledgeProvider;

  constructor(
    localProvider: GhanaApprovedMedicationProvider = defaultMedicationProvider,
    dailyMedProvider: DailyMedKnowledgeProvider = defaultDailyMedProvider
  ) {
    this.localProvider = localProvider;
    this.dailyMedProvider = dailyMedProvider;
  }

  async search(query: string, options?: MedicationSearchOptions): Promise<ApprovedMedication[]> {
    // 1. Primary search in national approved registry
    const localResults = await this.localProvider.search(query, options);
    if (localResults.length > 0 || !query.trim()) {
      return localResults;
    }

    // 2. Auxiliary search in DailyMed if local registry yields no results
    try {
      const dailyMedResults = await this.dailyMedProvider.search(query, options);
      return dailyMedResults;
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<ApprovedMedication | null> {
    const local = await this.localProvider.getById(id);
    if (local) return local;

    if (id.startsWith("DAILYMED-") || id.length > 20) {
      return this.dailyMedProvider.getById(id);
    }
    return null;
  }

  async getByNameOrBrand(name: string): Promise<ApprovedMedication | null> {
    const local = await this.localProvider.getByNameOrBrand(name);
    if (local) return local;

    try {
      return await this.dailyMedProvider.getByNameOrBrand(name);
    } catch {
      return null;
    }
  }

  async getAll(): Promise<ApprovedMedication[]> {
    return this.localProvider.getAll();
  }
}

export const defaultCompositeMedicationProvider = new CompositeMedicationProvider();
