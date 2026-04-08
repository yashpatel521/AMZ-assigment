import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { RequestError } from "./utils/types";

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Built-in body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API version endpoint
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "AMZ Webhook Server is running!",
  });
});

// -----------------------------
// Routes
// -----------------------------
import gmailRoutes from "./routes/gmail.route";
import { AppDataSource } from "./config/data-source";
import { watchGmail } from "./services/gmail";
import { carrierRFQService } from "./services/carrier/carrier-rfq.service";

app.use("/", gmailRoutes); // This will map /webhook to our new handler


// -----------------------------
// Global Error Handler
// -----------------------------
app.use(
  (err: RequestError, _req: Request, res: Response, next: NextFunction) => {
    let statusCode = err.code || 500;

    return res.status(statusCode).json({
      success: false,
      name: err.name,
      message: err.message,
      data: err.stack,
    });
  },
);

// -----------------------------
// Initialize database & start server
// -----------------------------

// Renew Gmail watch every 6 days (expires after 7)
function scheduleWatchRenewal() {
  const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
  setInterval(async () => {
    console.log("🔄 Renewing Gmail watch...");
    await watchGmail();
  }, SIX_DAYS_MS);
}

AppDataSource.initialize()
  .then(() => {
    console.log("💿 Connected to SQLite Database");

    app.listen(PORT, async () => {
      console.log(`🚀 CONNECTED TO DB AND SERVER STARTED ON PORT - ${PORT}`);

      try {
        await watchGmail();
        scheduleWatchRenewal();
        
        // Initialize carrier RFQ service and process any pending requests
        await carrierRFQService.processPendingDetailsComplete();
      } catch (err: any) {
        console.error("❌ Failed to start Gmail watch:", err.message);
        console.error(
          "   → Make sure token.json exists. Run: node get-token.js",
        );
      }
    });
  })
  .catch((error) => console.log("Database connection error: ", error));
