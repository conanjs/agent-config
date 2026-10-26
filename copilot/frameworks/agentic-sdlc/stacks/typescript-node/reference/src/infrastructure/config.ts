// Tier B (PDM-class-modeled-R7, docs/architecture.md §7): a config declaration, read once at startup.
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(8080),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/** Settings validated at startup; nothing else reads the environment (TSN-9). */
export type Config = Readonly<z.infer<typeof Schema>>;

/**
 * Validates the environment and freezes the result.
 *
 * @param env - Usually `process.env`; tests pass their own object.
 * @returns The parsed settings, with defaults filled in.
 * @throws `ZodError` when a value is invalid, so the process stops before it serves traffic.
 */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return Object.freeze(Schema.parse(env));
}
