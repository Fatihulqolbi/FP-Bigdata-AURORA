import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./modules/auth/auth.routes.js";
import listingRoutes from "./modules/marketplace/listing.routes.js";
import demandRoutes from "./modules/marketplace/demand.routes.js";
import matchingRoutes from "./modules/marketplace/matching.routes.js";
import orderRoutes from "./modules/marketplace/order.routes.js";
import materialRoutes from "./modules/marketplace/material.routes.js";
import tpsRoutes from "./modules/marketplace/tps.routes.js";
import { startTpsSimulation } from "./modules/marketplace/tps.simulation.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { logger } from "./utils/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "aurora-api", version: "1.0.0" });
});

// AURORA-INTEGRATION (Tahap 1 / Marketplace): register all routes
app.use("/api/auth", authRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/demands", demandRoutes);
app.use("/api/matches", matchingRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tps", tpsRoutes);

// Start background TPS volume simulation
startTpsSimulation();

app.listen(PORT, () => {
  logger.info(`AURORA API running on http://localhost:${PORT}`);
  logger.info("Routes registered:");
  logger.info("  /api/auth        - Authentication & admin");
  logger.info("  /api/materials   - Material categories");
  logger.info("  /api/listings    - Marketplace listings");
  logger.info("  /api/demands     - Buyer demands");
  logger.info("  /api/matches     - Matching engine");
  logger.info("  /api/orders      - Order management");
});

export default app;
