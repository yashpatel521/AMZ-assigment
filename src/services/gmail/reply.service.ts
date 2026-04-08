import { gmail_v1 } from "googleapis";

/**
 * Sends a threaded reply email via the Gmail API.
 */
export async function replyToEmail({
  gmail,
  threadId,
  to,
  subject,
  originalMsgId,
  body,
}: {
  gmail: gmail_v1.Gmail;
  threadId: string;
  to: string;
  subject: string;
  originalMsgId: string;
  body: string;
}) {
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  const rawMessage = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${originalMsgId}`,
    `References: ${originalMsgId}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    body,
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

  console.log(`✅ Reply sent to: ${to}`);
}
