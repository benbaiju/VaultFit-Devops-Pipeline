import promBundle from "express-prom-bundle";

export const metricsMiddleware = promBundle({
  metricsPath: "/metrics",
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  promClient: {
    collectDefaultMetrics: {},
  },
});
