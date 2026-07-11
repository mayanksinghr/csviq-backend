import { z } from "zod";

export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export const crmRecordSchema = z.object({
  created_at: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  mobile_without_country_code: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  lead_owner: z.string().nullable().optional(),
  crm_status: z.enum(CRM_STATUS_VALUES).nullable().optional(),
  crm_note: z.string().nullable().optional(),
  data_source: z.enum(DATA_SOURCE_VALUES).nullable().optional(),
  possession_time: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type CrmRecord = z.infer<typeof crmRecordSchema>;

export const geminiBatchItemSchema = z.object({
  sourceRowIndex: z.number(),
  record: crmRecordSchema,
  columnMapping: z.record(z.string(), z.string()).optional(),
});

export const geminiBatchResponseSchema = z.object({
  results: z.array(geminiBatchItemSchema),
});

export type GeminiBatchItem = z.infer<typeof geminiBatchItemSchema>;
export type GeminiBatchResponse = z.infer<typeof geminiBatchResponseSchema>;

// Server-side enforcement of the assignment's mandatory skip rule.
// Never trust the AI to have applied this correctly — re-check independently.
export function shouldSkipRecord(record: CrmRecord): boolean {
  const hasEmail = !!record.email && record.email.trim().length > 0;
  const hasMobile =
    !!record.mobile_without_country_code &&
    record.mobile_without_country_code.trim().length > 0;
  return !hasEmail && !hasMobile;
}