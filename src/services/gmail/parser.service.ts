import { gmail_v1 } from "googleapis";

/**
 * Extracts plain text or HTML body from an email payload recursively.
 */
export function getEmailBody(payload: gmail_v1.Schema$MessagePart): string | null {
  // Direct body data on the payload itself
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }

  function findText(parts: gmail_v1.Schema$MessagePart[]): string | null {
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf8");
      }
      if (part.parts) {
        const result = findText(part.parts);
        if (result) return result;
      }
    }
    return null;
  }

  const text = payload.parts ? findText(payload.parts) : null;
  if (text) return text;

  // Fallback to HTML
  function findHTML(parts: gmail_v1.Schema$MessagePart[]): string | null {
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf8");
      }
      if (part.parts) {
        const result = findHTML(part.parts);
        if (result) return result;
      }
    }
    return null;
  }

  return payload.parts ? findHTML(payload.parts) : "(no body)";
}
