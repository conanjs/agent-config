import type { Request, Response } from "express";
import type { ReviseDocument } from "@/application/ReviseDocument.js";
import type { HttpErrorMapper } from "@/interface/errors/HttpErrorMapper.js";
import { ReviseDocumentBody } from "./ReviseDocumentBody.js";

/** Handles `PUT /documents/:id`: parses input, calls one use case and maps the result (EXP-1). */
export class ReviseDocumentHandler {
  /**
   * Receives already-built collaborators from the composition root (EXP-2).
   *
   * @param reviseDocument - The use case this route adapts.
   * @param errors - Shared mapper from refusal reasons to status codes.
   */
  public constructor(
    private readonly reviseDocument: ReviseDocument,
    private readonly errors: HttpErrorMapper,
  ) {}

  /**
   * Answers one request; Express 5 forwards a rejected promise to the error middleware (EXP-6).
   *
   * @returns Resolves once the response is sent.
   */
  public async handle(req: Request<{ id: string }>, res: Response): Promise<void> {
    const parsed = ReviseDocumentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid-request" });
      return;
    }

    const result = await this.reviseDocument.run({ id: req.params.id, ...parsed.data });
    if (!result.ok) {
      res.status(this.errors.statusFor(result.error)).json({ error: result.error });
      return;
    }

    res.json(result.value);
  }
}
