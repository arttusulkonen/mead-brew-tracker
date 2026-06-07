import * as logger from "firebase-functions/logger";
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";

setGlobalOptions({ maxInstances: 10 });

export const healthCheck = onRequest((request, response) => {
  logger.info("AI Backend is running!", { structuredData: true });
  response.send({ status: "ok" });
});