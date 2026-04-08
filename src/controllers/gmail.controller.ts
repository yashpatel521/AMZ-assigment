import { Request, Response } from "express";
import { processNewEmails } from "../services/gmail";

export async function webhookHandler(req: Request, res: Response) {
  // Always respond with 200 immediately to acknowledge receipt with Pub/Sub
  res.sendStatus(200);
  try {
    const message = req.body?.message;
    if (!message?.data) {
      console.log("⚠️ No data in Pub/Sub message");
      return;
    }

    const decoded = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf-8"),
    );
    console.log("📬 Pub/Sub notification:", decoded);

    // historyId must be string
    if (decoded.historyId) {
      await processNewEmails(decoded.historyId.toString());
    }
  } catch (err: any) {
    console.error("❌ Webhook error:", err.message);
  }
}
