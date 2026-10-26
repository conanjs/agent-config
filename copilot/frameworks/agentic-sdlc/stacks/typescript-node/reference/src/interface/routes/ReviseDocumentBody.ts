import { z } from "zod";

/** Body of `PUT /documents/:id`; unknown keys are rejected so typos fail loudly (EXP-7). */
export const ReviseDocumentBody = z
  .object({
    body: z.string(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
