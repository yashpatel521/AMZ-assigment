import { google } from "googleapis";
import { getOAuthClient } from "../auth.service";
import { AppDataSource } from "../../config/data-source";
import { Setting } from "../../entities/Setting";

/**
 * Registers a Gmail push-notification watch on the inbox.
 * Saves the initial historyId to SQLite if not already stored.
 */
export async function watchGmail() {
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: "projects/webhookgmail-492712/topics/gmail-notifications",
      labelIds: ["INBOX"],
    },
  });

  console.log("👀 Watching Gmail inbox...");
  console.log(
    "   Expiration:",
    new Date(Number(res.data.expiration)).toLocaleString(),
  );

  const settingRepo = AppDataSource.getRepository(Setting);
  let historySetting = await settingRepo.findOne({ where: { key: "historyId" } });

  if (!historySetting && res.data.historyId) {
    historySetting = settingRepo.create({
      key: "historyId",
      value: res.data.historyId.toString(),
    });
    await settingRepo.save(historySetting);
    console.log("📌 Saved initial historyId:", res.data.historyId);
  }
}
