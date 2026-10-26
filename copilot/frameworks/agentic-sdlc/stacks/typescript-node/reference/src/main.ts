// Tier B (PDM-class-modeled-R7, docs/architecture.md §7): the process entry point.
// It reads config, creates the logger and starts listening; all wiring is in CompositionRoot.
import { pino } from "pino";
import { loadConfig } from "@/infrastructure/config.js";
import { CompositionRoot } from "./CompositionRoot.js";

const config = loadConfig(process.env);
const logger = pino({ level: config.LOG_LEVEL });

new CompositionRoot(logger).app().listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "server.started");
});
