import Groq from "groq-sdk";
import { env } from "../config/env";
import {
  geminiBatchResponseSchema,
  GeminiBatchResponse,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
} from "../validators/crmRecord.schema";

const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

const CRM_FIELD_LIST = [
  "created_at", "name", "email", "country_code",
  "mobile_without_country_code", "company", "city", "state", "country",
  "lead_owner", "crm_status", "crm_note", "data_source",
  "possession_time", "description",
];

const SYSTEM_PROMPT = `You are a data-mapping engine for a real estate CRM called GrowEasy.

You will receive a batch of CSV rows exported from unknown sources (Facebook Lead Ads, Google Ads, manual spreadsheets, other CRMs). Column names are inconsistent and vary per file — you must intelligently infer meaning from column names AND values, not just exact string matches.

Map each row into this FIXED CRM schema:
${CRM_FIELD_LIST.join(", ")}

STRICT RULES:

1. crm_status must be exactly one of: ${CRM_STATUS_VALUES.join(", ")}. If the source data doesn't clearly indicate a status, leave it null. Never invent a status.

2. data_source must be exactly one of: ${DATA_SOURCE_VALUES.join(", ")}. If none match confidently, leave it null. Do not guess.

3. created_at must be a date string parseable by JavaScript's "new Date(created_at)". Prefer ISO 8601 format (e.g. "2026-05-13 14:20:48"). If the source has no usable date, leave it null.

4. MULTIPLE EMAILS: if a row contains more than one email address, use only the FIRST one for the "email" field. Append all remaining emails into "crm_note".

5. MULTIPLE MOBILE NUMBERS: same rule — use only the FIRST mobile number for "mobile_without_country_code". Append all remaining numbers into "crm_note".

6. mobile_without_country_code must contain ONLY the local number, never the country code digits. Extract country_code separately (e.g. "+91") when identifiable.

7. crm_note is a catch-all: use it for remarks, follow-up notes, extra phone numbers, extra emails, or any useful information from the row that doesn't fit any other field. Combine multiple notes with "; " as a separator. Keep it as a single line.

8. Never fabricate data. If a field cannot be confidently determined from the row, leave it null.

9. For each row, also return "columnMapping": a simple flat object with string keys and string values only, showing which original source column was used for each populated CRM field. Keep this object small — only include fields that were actually mapped. Never add extra whitespace or padding.

10. Preserve row order using "sourceRowIndex" — the 0-based index of the row within this batch.

Return ONLY a valid JSON object with this exact shape, and nothing else (no markdown, no code fences, no explanation before or after):
{
  "results": [
    {
      "sourceRowIndex": 0,
      "record": {
        "created_at": null, "name": null, "email": null, "country_code": null,
        "mobile_without_country_code": null, "company": null, "city": null,
        "state": null, "country": null, "lead_owner": null, "crm_status": null,
        "crm_note": null, "data_source": null, "possession_time": null, "description": null
      },
      "columnMapping": { "example_field": "Example_Source_Column" }
    }
  ]
}`;

export interface ExtractBatchInput {
  rows: Record<string, string>[];
  batchStartIndex: number;
}

// ---- Error types -----------------------------------------------------

export type AiErrorCategory =
  | "RATE_LIMIT"
  | "INVALID_RESPONSE"
  | "EMPTY_RESPONSE"
  | "INVALID_JSON"
  | "UNKNOWN";

export class RateLimitExhaustedError extends Error {
  retryAfterSeconds: number | null;
  constructor(message: string, retryAfterSeconds: number | null) {
    super(message);
    this.name = "RateLimitExhaustedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Parses Groq's "Please try again in 1h3m12.096s" style message into seconds.
function parseRetryAfterSeconds(raw: string): number | null {
  const match = raw.match(/try again in\s+((?:\d+h)?(?:\d+m)?(?:[\d.]+s)?)/i);
  if (!match) return null;

  const part = match[1];
  const hMatch = part.match(/(\d+)h/);
  const mMatch = part.match(/(\d+)m/);
  const sMatch = part.match(/([\d.]+)s/);

  const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
  const seconds = sMatch ? parseFloat(sMatch[1]) : 0;

  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? Math.ceil(total) : null;
}

function isRateLimitError(err: any): boolean {
  const raw = String(err?.message ?? err ?? "");
  return raw.includes("429") || raw.toLowerCase().includes("rate_limit");
}

export function classifyAiError(err: any): { category: AiErrorCategory; message: string } {
  const raw = String(err?.message ?? err ?? "");

  if (isRateLimitError(err)) {
    return {
      category: "RATE_LIMIT",
      message: "AI service was busy (rate limit). This batch was skipped — re-import the file to retry just these rows.",
    };
  }
  if (raw.toLowerCase().includes("schema validation")) {
    return {
      category: "INVALID_RESPONSE",
      message: "AI couldn't map these rows into the expected format. Re-importing usually fixes this.",
    };
  }
  if (raw.toLowerCase().includes("empty response")) {
    return {
      category: "EMPTY_RESPONSE",
      message: "AI service didn't return any data for these rows. Please re-import.",
    };
  }
  if (raw.toLowerCase().includes("not valid json")) {
    return {
      category: "INVALID_JSON",
      message: "AI service returned an unreadable response for these rows. Please re-import.",
    };
  }
  return {
    category: "UNKNOWN",
    message: "Something went wrong while processing these rows. Please re-import.",
  };
}

// ---- Main extraction ---------------------------------------------------

export async function extractCrmBatch(
  input: ExtractBatchInput
): Promise<GeminiBatchResponse> {
  const { rows } = input;

  const userPrompt = `Map the following CSV rows (as JSON array) into the CRM schema. The array index of each row is its sourceRowIndex.\n\nRows:\n${JSON.stringify(rows, null, 2)}`;

  async function callModel(model: string) {
    const response = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const rawText = response.choices[0]?.message?.content;
    if (!rawText) throw new Error("Groq returned an empty response");

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      console.error("RAW GROQ RESPONSE:\n", rawText.slice(0, 2000));
      throw new Error("Groq response was not valid JSON");
    }

    // Fallback/smaller models sometimes include unmapped fields in
    // columnMapping with a null value instead of omitting them.
    if (Array.isArray(parsedJson?.results)) {
      for (const item of parsedJson.results) {
        if (item && typeof item.columnMapping === "object" && item.columnMapping !== null) {
          for (const key of Object.keys(item.columnMapping)) {
            if (typeof item.columnMapping[key] !== "string") {
              delete item.columnMapping[key];
            }
          }
        }
      }
    }

    const validated = geminiBatchResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("SCHEMA VALIDATION FAILED:\n", validated.error.message);
      throw new Error(`Groq response failed schema validation: ${validated.error.message}`);
    }

    return validated.data;
  }

  try {
    return await callModel(PRIMARY_MODEL);
  } catch (primaryErr: any) {
    if (!isRateLimitError(primaryErr)) throw primaryErr;

    console.warn(`Primary model rate-limited, falling back to ${FALLBACK_MODEL}`);
    try {
      return await callModel(FALLBACK_MODEL);
    } catch (fallbackErr: any) {
      if (isRateLimitError(fallbackErr)) {
        const raw = String(fallbackErr?.message ?? "");
        const retryAfterSeconds = parseRetryAfterSeconds(raw);
        throw new RateLimitExhaustedError(
          "Both AI models have hit their rate limit.",
          retryAfterSeconds
        );
      }
      throw fallbackErr;
    }
  }
}