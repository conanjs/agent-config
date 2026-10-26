import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import type { ReviseDocumentError } from "@/application/ReviseDocument.js";

/** The single place that turns failures into HTTP responses (TSN-11, EXP-5). */
export class HttpErrorMapper {
  // A Record over the union makes the compiler reject a new error code that has no status.
  readonly #statuses: Readonly<Record<ReviseDocumentError, number>> = {
    "not-found": 404,
    "version-conflict": 409,
    "invalid-body": 422,
  };

  /**
   * Binds the mapper to the logger that records unexpected failures.
   *
   * @param logger - Receives one `request.failed` event per 500 response.
   */
  public constructor(private readonly logger: Logger) {}

  /**
   * Picks the status for a refused revision.
   *
   * @returns 404, 409 or 422.
   */
  public statusFor(error: ReviseDocumentError): number {
    return this.#statuses[error];
  }

  /**
   * Builds the Express error middleware for thrown errors, mounted after every route.
   *
   * @returns Middleware that answers 4xx for malformed requests and 500 for everything else.
   */
  public handler(): ErrorRequestHandler {
    return (err: unknown, _req, res, _next) => {
      // The JSON body parser marks malformed input with a 4xx status; anything else is a bug or an I/O failure.
      const status =
        typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
          ? err.status
          : 500;
      if (status >= 500) this.logger.error({ err }, "request.failed");
      res.status(status).json({ error: status >= 500 ? "internal" : "invalid-request" });
    };
  }
}
