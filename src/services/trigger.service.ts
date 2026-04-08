export interface TriggerPayload {
  from: string;
  subject: string;
  body: string | null;
  messageId: string;
  threadId: string;
}

export async function myProjectTrigger(payload: TriggerPayload) {
  console.log("\n⚡ Triggering project logic...");

  // 👇 ADD YOUR LOGIC HERE
  // Examples:
  // - Save to database
  // - Call an external API
  // - Send a Slack notification
  // - Process order/support ticket
  // - Run a background job

  console.log("   Done! Custom logic executed for message:", payload.messageId);
}
