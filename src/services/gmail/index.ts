import { google } from "googleapis";
import { getOAuthClient } from "../auth.service";

export function getGmailClient() {
  const auth = getOAuthClient();
  return google.gmail({ version: "v1", auth });
}

// Barrel export for all gmail services
export { watchGmail } from "./watch.service";
export { processNewEmails } from "./history.service";
export { handleEmail } from "./handle-email.service";
export { getEmailBody } from "./parser.service";
export { replyToEmail } from "./reply.service";
