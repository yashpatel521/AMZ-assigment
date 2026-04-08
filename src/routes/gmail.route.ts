import { Router } from "express";
import { webhookHandler } from "../controllers/gmail.controller";

const router = Router();

// Webhook endpoint (Pub/Sub pushes here)
router.post("/webhook", webhookHandler);

export default router;
