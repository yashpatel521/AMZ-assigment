import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "token.json");

export default async function getToken() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const { client_id, client_secret, redirect_uris } =
    creds.installed || creds.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );

  // Load existing token
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    oauth2Client.setCredentials(tokens);
    console.log("✅ Existing token found at", TOKEN_PATH);
  } else {
    // Generate new token if not exists
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    });

    console.log("✅ Visit this URL in your browser:\n", url, "\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const code = await new Promise<string>((resolve) => {
      rl.question("Paste the code from the page here: ", (input) => {
        rl.close();
        resolve(input.trim());
      });
    });

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log("✅ Token saved to", TOKEN_PATH);
  }

  // Auto-refresh token and save
  oauth2Client.on("tokens", (newTokens) => {
    if (newTokens.refresh_token) {
      const existing = fs.existsSync(TOKEN_PATH)
        ? JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"))
        : {};
      const updated = { ...existing, ...newTokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
      console.log("🔄 Token refreshed and saved");
    }
  });

  return oauth2Client;
}

// To allow running directly from CLI `ts-node src/scripts/get-token.ts`
if (require.main === module) {
  getToken().catch(console.error);
}
