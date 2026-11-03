import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { RecordApproval } from "#src/modules/workflow/application/record-approval/RecordApproval.ts";
import type { HumanConsole } from "#src/modules/runner/domain/ports/HumanConsole.ts";

/** Records a gate decision typed by the person at the controlling terminal (specs/020 D27); the caller then resumes the run. */
export class ApproveGate {
  readonly #console: HumanConsole;
  readonly #approvals: RecordApproval;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param console - asks the person at the terminal
   * @param approvals - records the decision in the ledger (phase 1 rules: the gate must be open)
   */
  public constructor(console: HumanConsole, approvals: RecordApproval) {
    this.#console = console;
    this.#approvals = approvals;
  }

  /**
   * Returns true when recorded, or why not.
   *
   * @param project - the main checkout
   * @param decision - `approve G3 R-007 <words>` or `changes G3 R-007 <words>`
   * @param gate - the gate the person must type back to confirm
   * @returns true when recorded, or why not
   */
  public async run(project: string, decision: string, gate: string): Promise<Result<true, string>> {
    const typed = await this.#console.ask(`Type ${gate} to confirm "${decision}": `);
    if (!typed.ok) return err(typed.error);
    if (typed.value.trim().toUpperCase() !== gate.toUpperCase())
      return err(`you typed "${typed.value.trim()}", not ${gate}; nothing recorded`);
    const outcomes = await this.#approvals.run(project, decision, {
      source: "runner:terminal",
      session: "tty",
    });
    const mine = outcomes.find((o) => o.gate === gate.toUpperCase());
    return mine?.recorded === true
      ? ok(true)
      : err(mine?.why ?? `no decision for ${gate} found in "${decision}"`);
  }
}
