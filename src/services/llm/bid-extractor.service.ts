/**
 * Extracted bid details from a carrier email.
 */
export interface BidDetails {
  price: number | null;
  additionalFees: string | null;
  transitTime: string | null;
  equipmentType: string | null;
  message: string | null;
}

/**
 * Custom LLM-style extractor: uses keyword + regex patterns to pull
 * structured bid information from carrier email replies.
 *
 * Replace the internals with a real LLM API call (OpenAI, Gemini, etc.)
 * when ready — the interface stays the same.
 */
export function extractBidDetails(
  subject: string,
  body: string,
): BidDetails {
  const text = `${subject}\n${body}`;

  return {
    price: extractPrice(text),
    additionalFees: extractAdditionalFees(text),
    transitTime: extractTransitTime(text),
    equipmentType: extractEquipmentType(text),
    message: extractMessage(text),
  };
}

// ─── Price Extraction ─────────────────────────────────────────────────────────

function extractPrice(text: string): number | null {
  const pricePatterns = [
    // Counter-offer specific patterns
    /(?:my\s+new\s+bid|new\s+bid|revised\s+bid|updated\s+bid)[:\s]*\$?\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/i, // My new bid: $675.00
    /(?:can\s+beat|beat|beat\s+that)\s+(?:the\s+)?price\s+(?:of)?\s*\$?\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/i, // I can beat that price of $699.00
    /(?:best\s+and\s+final|final\s+offer|final\s+bid)[:\s]*\$?\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/i, // Best and final: $650.00
    /(?:counter\s+offer|counter\s+bid)[:\s]*\$?\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/i, // Counter offer: $650.00
    
    // Standard patterns
    /\$\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/, // $850.00, $1,250.50
    /(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|usd|bucks)/i, // 850 dollars
    /(?:price|rate|quote|cost|bid|charge|fee)[:\s]*\$?\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/i, // price: $850
    /(?:can handle|offer|quote|bid|price|rate)[:\s]*(?:for|at)?\s*\$?\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/i, // can handle for $850
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const priceStr = match[1].replace(/,/g, '');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  }

  return null;
}

// ─── Additional Fees Extraction ─────────────────────────────────────────────

function extractAdditionalFees(text: string): string | null {
  const feePatterns = [
    /(?:includes?|covers?|includes?)(?:\s+(?:all|standard))?\s+(?:charges?|fees?|costs?)[:\s]*([^\n.]+)/i,
    /(?:additional|extra|accessorial)\s+(?:fees?|charges?|costs?)[:\s]*([^\n.]+)/i,
    /(?:fuel|surcharge|insurance|detention|layover)\s+(?:fee|charge|cost)[:\s]*([^\n.]+)/i,
  ];

  for (const pattern of feePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  // Check if email mentions "all inclusive" or similar
  if (/(?:all inclusive|includes everything|no additional|no extra)/i.test(text)) {
    return "All inclusive";
  }

  return null;
}

// ─── Transit Time Extraction ───────────────────────────────────────────────

function extractTransitTime(text: string): string | null {
  const transitPatterns = [
    /(?:transit|delivery|transit time|delivery time|lead time|eta)[:\s]*([^\n.]+)/i,
    /(\d{1,2})\s*(?:days?|hours?)(?:\s*transit)?/i,
    /(?:will|can)\s+(?:deliver|arrive|ship|transport)\s+(?:in|within)?\s*(\d{1,2})\s*(?:days?|hours?)/i,
  ];

  for (const pattern of transitPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

// ─── Equipment Type Extraction ─────────────────────────────────────────────

function extractEquipmentType(text: string): string | null {
  const equipmentPatterns = [
    /(?:equipment|truck|trailer|vehicle)[:\s]*([^\n.,]+)/i,
    /\b(53ft|53'|48ft|48'|dry van|reefer|flatbed|step deck|lowboy|box truck|cargo van)\b/i,
  ];

  for (const pattern of equipmentPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

// ─── Message Extraction ────────────────────────────────────────────────────

function extractMessage(text: string): string | null {
  // Extract the main message content (excluding greetings and sign-offs)
  const lines = text.split('\n');
  const messageLines: string[] = [];
  let inMessage = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip greetings and sign-offs
    if (/^(hi|hello|dear|regards|thanks|thank you|best regards|sincerely)/i.test(trimmed)) {
      continue;
    }

    // Skip empty lines
    if (!trimmed) {
      if (inMessage && messageLines.length > 0) {
        inMessage = false;
      }
      continue;
    }

    // Start capturing message content
    if (!inMessage) {
      inMessage = true;
    }

    messageLines.push(trimmed);
  }

  const message = messageLines.join(' ').trim();
  return message.length > 0 ? message : null;
}
