import { gmail_v1 } from "googleapis";
import { extractEmail, findCustomerByEmail } from "../customer-reply.service";
import { getEmailBody } from "./parser.service";
import { processFreightRequest } from "../freight/freight.service";

/**
 * Fetches a single email, identifies whether the sender is a known customer,
 * and if so runs the full freight-extraction + reply pipeline.
 */
export async function handleEmail(messageId: string, gmail: gmail_v1.Gmail) {
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  if (!msg.data.payload) return;

  const headers = msg.data.payload.headers || [];
  const from = headers.find((h) => h.name === "From")?.value || "";
  const subject = headers.find((h) => h.name === "Subject")?.value || "(no subject)";
  const msgId = headers.find((h) => h.name === "Message-ID")?.value || "";
  const threadId = msg.data.threadId || "";

  const body = getEmailBody(msg.data.payload);

  console.log("\n📧 New Email Received!");
  console.log("   From   :", from);
  console.log("   Subject:", subject);
  console.log("   Body   :", body?.substring(0, 200));

  // ─── Skip emails sent by ourselves (avoid reply loops) ───────────────────
  // Our sending account is yash1451999@gmail.com — filter it out
  const senderEmail = extractEmail(from);
  if (senderEmail === "yash1451999@gmail.com") {
    console.log("⏭️  Skipping — this is our own outbound reply.");
    return;
  }

  // ─── Check if sender is a known customer ─────────────────────────────────
  const customer = await findCustomerByEmail(senderEmail);

  if (!customer) {
    console.log(`ℹ️  Sender (${senderEmail}) is not a registered customer. Ignoring.`);
    return;
  }

  console.log(`📬 Customer email detected from: ${senderEmail} → running freight pipeline...`);

  await processFreightRequest({
    gmail,
    customer,
    subject,
    body,
    threadId,
    messageId: msgId,
    from,
  });
}
