import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

export function getOAuthClient() {
  const credsPath = path.join(process.cwd(), "credentials.json");
  const tokenPath = path.join(process.cwd(), "token.json");

  const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
  const { client_id, client_secret, redirect_uris } =
    creds.installed || creds.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );

  if (fs.existsSync(tokenPath)) {
    const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    oauth2Client.setCredentials(tokens);
  }

  // Auto-save refreshed tokens
  oauth2Client.on("tokens", (newTokens) => {
    let existing = {};
    if (fs.existsSync(tokenPath)) {
      existing = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    }
    const updated = { ...existing, ...newTokens };
    fs.writeFileSync(tokenPath, JSON.stringify(updated, null, 2));
    console.log("🔄 Token refreshed and saved.");
  });

  return oauth2Client;
}
