import { z } from "zod";

export const consentRecordSchema = z.object({
  type: z.enum([
    "privacy",
    "ai_processing",
    "data_retention",
    "location",
    "trusted_contact",
  ]),
  policyVersion: z.string().default("1.0"),
  status: z.enum(["granted", "withdrawn"]).default("granted"),
  scope: z.string().optional(),
});

export type ConsentRecordInput = z.infer<typeof consentRecordSchema>;
