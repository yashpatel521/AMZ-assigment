// ─── Static message templates for AMZ Freight ────────────────────────────────

export const MESSAGES = {
  /**
   * Sent when extracted details are INCOMPLETE.
   * Lists exactly which fields the customer still needs to provide.
   */
  MISSING_DETAILS: {
    subject: (originalSubject: string) =>
      originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`,

    body: (missingFieldLabels: string[], quoteId: string, customerName?: string) => `Hi ${customerName || "there"},

Thank you for contacting AMZ Freight! We'd love to get you a quote as quickly as possible.

To proceed, we just need a few more details about your shipment (Quote Ref: ${quoteId}):

${missingFieldLabels.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}

Once you provide the above information, we'll get back to you with a freight quote right away.

Best regards,
AMZ Freight Team
📦 Fast. Reliable. On Time.`,
  },

  /**
   * Sent when all required details have been extracted successfully.
   * Confirms the details back to the customer and sets expectation.
   */
  DETAILS_CONFIRMED: {
    subject: (originalSubject: string) =>
      originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`,

    body: (
      details: {
        origin?: string | null;
        destination?: string | null;
        freightType?: string | null;
        weight?: string | null;
        dimensions?: string | null;
        pieces?: string | null;
        pickupDate?: string | null;
      },
      quoteId: string,
      customerName?: string,
    ) => `Hi ${customerName || "there"},

Thank you for reaching out to AMZ Freight!

We've received your shipment request and here's a summary of what we've captured (Quote Ref: ${quoteId}):

  📍 Origin         : ${details.origin || "N/A"}
  📍 Destination    : ${details.destination || "N/A"}
  📦 Freight Type   : ${details.freightType || "N/A"}
  ⚖️  Weight         : ${details.weight || "N/A"}
  📐 Dimensions     : ${details.dimensions || "N/A"}
  🔢 Pieces/Pallets : ${details.pieces || "N/A"}
  📅 Pickup Date    : ${details.pickupDate || "N/A"}

Our team is now working on sourcing the best rates from our carrier network. We'll get back to you with a detailed quote shortly.

If any of the above details are incorrect, just reply to this email with the corrections.

Best regards,
AMZ Freight Team
📦 Fast. Reliable. On Time.`,
  },

  /**
   * Sent immediately when a known customer's email is received,
   * before any extraction or quoting has started.
   * Lets them know their request has been received and is being processed.
   */
  CUSTOMER_QUOTE_ACKNOWLEDGEMENT: {
    subject: (originalSubject: string) =>
      originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`,

    body: (customerName?: string) => `Hi ${customerName || "there"},

Thank you for reaching out to AMZ Freight!

We've received your freight quote request and our team is already on it. You'll hear back from us shortly with more details.

Best regards,
AMZ Freight Team
📦 Fast. Reliable. On Time.`,
  },

  /**
   * Sent to each carrier asking for their rate on a shipment.
   */
  CARRIER_RFQ: {
    subject: (quoteId: string) => `Rate Request | ${quoteId}`,

    body: (
      details: {
        origin?: string | null;
        destination?: string | null;
        freightType?: string | null;
        weight?: string | null;
        dimensions?: string | null;
        pieces?: string | null;
        pickupDate?: string | null;
      },
      quoteId: string,
      carrierName?: string,
    ) => `Hi ${carrierName || "there"},

We have a new shipment opportunity and would like to request your best rate for the following load:

  Quote Ref  : ${quoteId}
  📍 Origin         : ${details.origin || "N/A"}
  📍 Destination    : ${details.destination || "N/A"}
  📦 Freight Type   : ${details.freightType || "N/A"}
  ⚖️  Weight         : ${details.weight || "N/A"}
  📐 Dimensions     : ${details.dimensions || "N/A"}
  🔢 Pieces/Pallets : ${details.pieces || "N/A"}
  📅 Pickup Date    : ${details.pickupDate || "N/A"}

Please reply to this email with your rate at your earliest convenience. Reference the Quote Ref in your response.

Thank you,
AMZ Freight Team
📦 Fast. Reliable. On Time.`,
  },
} as const;


