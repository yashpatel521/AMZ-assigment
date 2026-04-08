/**
 * Extracted freight details from a customer email.
 * Any field that couldn't be found will be null.
 */
export interface FreightDetails {
  origin: string | null;
  destination: string | null;
  freightType: string | null;
  weight: string | null;
  dimensions: string | null;
  pieces: string | null;
  pickupDate: string | null;
}

/** Fields that are mandatory before we can request a carrier quote */
export const REQUIRED_FIELDS: (keyof FreightDetails)[] = [
  "origin",
  "destination",
  "freightType",
  "weight",
  "pickupDate",
];

/** Human-readable field labels for use in reply emails */
export const FIELD_LABELS: Record<keyof FreightDetails, string> = {
  origin: "Pickup / Origin location",
  destination: "Delivery / Destination location",
  freightType: "Type of freight / commodity",
  weight: "Total weight (lbs or kg)",
  dimensions: "Dimensions (L x W x H)",
  pieces: "Number of pieces / pallets",
  pickupDate: "Desired pickup date",
};

/**
 * Custom LLM-style extractor: uses keyword + regex patterns to pull
 * structured freight information from a free-text email body.
 *
 * Replace the internals with a real LLM API call (OpenAI, Gemini, etc.)
 * when ready — the interface stays the same.
 */
export function extractFreightDetails(
  subject: string,
  body: string,
): FreightDetails {
  const text = `${subject}\n${body}`.toLowerCase();

  return {
    origin: extractPattern(text, [
      /(?:from|pickup|origin|ship(?:ping)? from|collect(?:ion)? from)[:\s]+([a-z0-9\s,.-]+?)(?:\n|to |dest)/i,
      /\bfrom\b[:\s]+([a-z0-9\s,.-]{3,50})/i,
    ]),

    destination: extractPattern(text, [
      /(?:to|deliver(?:y)? to|destination|drop.?off|consignee)[:\s]+([a-z0-9\s,.-]+?)(?:\n|from |weight|type)/i,
      /\bto\b[:\s]+([a-z0-9\s,.-]{3,50})/i,
    ]),

    freightType: extractPattern(text, [
      /(?:freight type|commodity|cargo|goods|product|load)[:\s]+([a-z0-9\s,.-]+?)(?:\n|weight|dim)/i,
      /\b(ftl|ltl|partial|full.?load|pallet|parcel|hazmat|perishable|refrigerated|dry|liquid)\b/i,
    ]),

    weight: extractPattern(text, [
      /(?:weight|total weight|gross weight)[:\s]+([\d,.]+\s*(?:lbs?|kg|kgs|pounds?|kilograms?))/i,
      /([\d,.]+\s*(?:lbs?|kg|kgs|pounds?|kilograms?))/i,
    ]),

    dimensions: extractPattern(text, [
      /(?:dim(?:ension)?s?|size)[:\s]+([\d\s,.x×*]+(?:in|cm|ft|inches?)?)/i,
      /([\d]+\s*[x×*]\s*[\d]+\s*[x×*]\s*[\d]+)/i,
    ]),

    pieces: extractPattern(text, [
      /(?:pieces?|pallets?|skids?|units?|qty|quantity)[:\s]+([\d]+)/i,
      /([\d]+)\s*(?:pieces?|pallets?|skids?|boxes|crates?)/i,
    ]),

    pickupDate: extractPattern(text, [
      /(?:pickup date|pick.?up|ready date|ship(?:ment)? date|collect(?:ion)? date)[:\s]+([a-z0-9\s,/-]+?)(?:\n|$)/i,
      /(?:on|by|before)\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i,
      /(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i,
    ]),
  };
}

/** Returns missing required field keys */
export function getMissingRequiredFields(details: FreightDetails): (keyof FreightDetails)[] {
  return REQUIRED_FIELDS.filter((field) => !details[field]);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function extractPattern(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}
