import cors from "cors";
import express from "express";
import helmet from "helmet";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { availabilityRouter } from "./routes/availability.js";
import { bookingsRouter } from "./routes/bookings.js";
import { healthRouter } from "./routes/health.js";
import { messagingRouter } from "./routes/messaging.js";
import { paymentsRouter } from "./routes/payments.js";
import { plansRouter } from "./routes/plans.js";
import { profilesRouter } from "./routes/profiles.js";
import { reviewsRouter } from "./routes/reviews.js";
import { servicesRouter } from "./routes/services.js";
import { ticketsRouter } from "./routes/tickets.js";
import { trainersRouter } from "./routes/trainers.js";
import { verificationRouter } from "./routes/verification.js";
import { errorHandler } from "./middleware/error-handler.js";
import { httpLogger } from "./middleware/http-logger.js";
import { metricsMiddleware } from "./middleware/metrics.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(metricsMiddleware);
app.use(httpLogger);
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({ service: "vaultfit-api", status: "ok" });
});

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/profiles", profilesRouter);
app.use("/trainers", trainersRouter);
app.use("/trainers", servicesRouter);
app.use("/trainers", availabilityRouter);
app.use("/bookings", bookingsRouter);
app.use("/payments", paymentsRouter);
app.use("/plans", plansRouter);
app.use("/", reviewsRouter);
app.use("/", messagingRouter);
app.use("/", ticketsRouter);
app.use("/", verificationRouter);
app.use("/", adminRouter);

app.use(errorHandler);
