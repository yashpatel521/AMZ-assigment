import { google } from "googleapis";
import { getOAuthClient } from "../auth.service";
import { AppDataSource } from "../../config/data-source";
import { Setting } from "../../entities/Setting";
import { handleEmail } from "./handle-email.service";

/**
 * Processes new emails using Gmail History API.
 * Reads historyId from SQLite, fetches new messages, and delegates to handleEmail.
 */
export async function processNewEmails(newHistoryId: string) {
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const settingRepo = AppDataSource.getRepository(Setting);
  let historySetting = await settingRepo.findOne({ where: { key: "historyId" } });

  if (!historySetting) {
    historySetting = settingRepo.create({ key: "historyId", value: newHistoryId });
    await settingRepo.save(historySetting);
    console.log("📌 First run — saving historyId.");
    return;
  }

  const lastHistoryId = historySetting.value;

  try {
    const historyRes = await gmail.users.history.list({
      userId: "me",
      startHistoryId: lastHistoryId.toString(),
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
    });

    historySetting.value = newHistoryId;
    await settingRepo.save(historySetting);
    console.log("📌 Updated historyId:", newHistoryId);

    const records = historyRes.data.history || [];

    if (records.length === 0) {
      console.log("ℹ️  No new messages found.");
      return;
    }

    for (const record of records) {
      for (const added of record.messagesAdded || []) {
        if (added.message?.id) {
          await handleEmail(added.message.id, gmail);
        }
      }
    }
  } catch (err: any) {
    console.error("❌ History fetch error:", err.message);
    if (err.message.includes("Invalid historyId")) {
      await settingRepo.remove(historySetting);
      console.log("🔁 historyId reset — will re-sync on next notification.");
    }
  }
}
