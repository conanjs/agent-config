import express, { type Express } from "express";
import type { Logger } from "pino";
import type { DocumentStore } from "@/application/ports/DocumentStore.js";
import { ReviseDocument } from "@/application/ReviseDocument.js";
import { InMemoryDocumentStore } from "@/infrastructure/InMemoryDocumentStore.js";
import { HttpErrorMapper } from "@/interface/errors/HttpErrorMapper.js";
import { ReviseDocumentHandler } from "@/interface/routes/ReviseDocumentHandler.js";

/**
 * The only class that knows concrete adapters: it builds the object graph and the HTTP app
 * (TSN-6, PDM-class-modeled-R9).
 */
export class CompositionRoot {
  /**
   * Takes the process-wide services that `main.ts` creates.
   *
   * @param logger - Root structured logger (TSN-10).
   * @param documents - Storage adapter; integration tests pass their own to seed data.
   */
  public constructor(
    private readonly logger: Logger,
    private readonly documents: DocumentStore = new InMemoryDocumentStore(),
  ) {}

  /**
   * Builds the Express app with every route and the error handler mounted.
   *
   * @returns An app that is not listening yet, so tests can bind it to a free port.
   */
  public app(): Express {
    const errors = new HttpErrorMapper(this.logger);
    const revise = new ReviseDocumentHandler(new ReviseDocument(this.documents), errors);

    const app = express();
    app.disable("x-powered-by");
    app.use(express.json({ limit: "10kb" }));
    // The route table: one line per route, so every endpoint is visible in one place.
    app.put("/documents/:id", (req, res) => revise.handle(req, res));
    app.use(errors.handler());
    return app;
  }
}
