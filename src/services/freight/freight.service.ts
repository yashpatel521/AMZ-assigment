import { gmail_v1 } from "googleapis";
import { AppDataSource } from "../../config/data-source";
import { FreightRequest } from "../../entities/FreightRequest";
import { Customer } from "../../entities/Customer";
import {
  extractFreightDetails,
  getMissingRequiredFields,
  FIELD_LABELS,
} from "../llm/freight-extractor.service";
import { replyToEmail } from "../gmail/reply.service";
import { MESSAGES } from "../../constants/messages";
import { sendRFQToAllCarriers } from "../carrier/carrier-outreach.service";

/**
 * Generates a sequential, human-readable quote ID: AMZ-00001, AMZ-00002, etc.
 */
async function generateQuoteId(): Promise<string> {
  const repo = AppDataSource.getRepository(FreightRequest);
  const count = await repo.count();
  const padded = String(count + 1).padStart(5, "0");
  return `AMZ-${padded}`;
}

/**
 * Main freight pipeline:
 * 1. Extract details from email using the LLM extractor
 * 2. If details are missing → reply asking for them + save record as pending
 * 3. If all details present → confirm them back to customer + save as complete
 */
export async function processFreightRequest({
  gmail,
  customer,
  subject,
  body,
  threadId,
  messageId,
  from,
}: {
  gmail: gmail_v1.Gmail;
  customer: Customer;
  subject: string;
  body: string | null;
  threadId: string;
  messageId: string;
  from: string;
}) {
  const repo = AppDataSource.getRepository(FreightRequest);

  const emailText = body || subject;
  const details = extractFreightDetails(subject, emailText);
  const missingFields = getMissingRequiredFields(details);

  const quoteId = await generateQuoteId();

  // ─── Save to database ─────────────────────────────────────────────────────
  const freightRequest = repo.create({
    quoteId,
    customerEmail: customer.email,
    customerName: customer.name,
    threadId,
    messageId,
    subject,
    rawBody: body ?? "",
    origin: details.origin ?? undefined,
    destination: details.destination ?? undefined,
    freightType: details.freightType ?? undefined,
    weight: details.weight ?? undefined,
    dimensions: details.dimensions ?? undefined,
    pieces: details.pieces ?? undefined,
    pickupDate: details.pickupDate ?? undefined,
    status: missingFields.length > 0 ? "pending_details" : "details_complete",
    missingFields: missingFields.join(","),
  });

  await repo.save(freightRequest);
  console.log(`📋 Freight request saved [${quoteId}] — status: ${freightRequest.status}`);

  // ─── Send appropriate reply ───────────────────────────────────────────────

  if (missingFields.length > 0) {
    console.log(`⚠️  Missing fields: ${missingFields.join(", ")}. Requesting from customer...`);

    const missingLabels = missingFields.map((f) => FIELD_LABELS[f]);
    const replyBody = MESSAGES.MISSING_DETAILS.body(missingLabels, quoteId, customer.name);
    const replySubject = MESSAGES.MISSING_DETAILS.subject(subject);

    await replyToEmail({ gmail, to: from, subject: replySubject, threadId, originalMsgId: messageId, body: replyBody });
    console.log(`📤 Missing-details reply sent to ${customer.email}`);
  } else {
    console.log(`✅ All details extracted. Sending confirmation to customer...`);

    const replyBody = MESSAGES.DETAILS_CONFIRMED.body(details, quoteId, customer.name);
    const replySubject = MESSAGES.DETAILS_CONFIRMED.subject(subject);

    await replyToEmail({ gmail, to: from, subject: replySubject, threadId, originalMsgId: messageId, body: replyBody });
    console.log(`📤 Confirmation reply sent to ${customer.email}`);

    // ─── Contact all carriers for rates ──────────────────────────────────
    await sendRFQToAllCarriers(gmail, freightRequest);
  }
}
