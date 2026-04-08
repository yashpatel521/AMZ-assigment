import { gmail_v1 } from "googleapis";
import { AppDataSource } from "../config/data-source";
import { Customer } from "../entities/Customer";
import { MESSAGES } from "../constants/messages";

/**
 * Checks if the sender is a known customer.
 * Extracts the raw email from strings like "John Doe <john@example.com>"
 */
export function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<(.+?)>/);
  return match ? match[1].toLowerCase() : fromHeader.toLowerCase().trim();
}

/**
 * Looks up a customer by email in the database.
 */
export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  const repo = AppDataSource.getRepository(Customer);
  return repo.findOne({ where: { email: email.toLowerCase() } });
}

/**
 * Sends an auto-reply acknowledgement to the customer confirming
 * their freight quote request was received.
 */
export async function sendCustomerAcknowledgement({
  gmail,
  to,
  subject,
  threadId,
  originalMsgId,
  customerName,
}: {
  gmail: gmail_v1.Gmail;
  to: string;
  subject: string;
  threadId: string;
  originalMsgId: string;
  customerName?: string;
}) {
  const template = MESSAGES.CUSTOMER_QUOTE_ACKNOWLEDGEMENT;
  const replySubject = template.subject(subject);
  const replyBody = template.body(customerName);

  const rawMessage = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${originalMsgId}`,
    `References: ${originalMsgId}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    replyBody,
  ].join("\r\n");

  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encoded,
      threadId,
    },
  });

  console.log(`✅ Customer acknowledgement sent to: ${to}`);
}
