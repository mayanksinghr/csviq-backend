import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import healthRoutes from "./routes/health.routes";
import importRoutes from "./routes/import.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/import", importRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`✅ CSVIQ backend running on http://localhost:${env.PORT}`);
});