import type { Clock } from '#src/modules/workflow/domain/ports/Clock.ts';
import type { RunRepository } from '#src/modules/workflow/domain/ports/RunRepository.ts';
import { Approval } from '#src/modules/workflow/domain/run/Approval.ts';
import type { ApprovalSource } from '#src/modules/workflow/domain/run/Run.ts';
import type { RunLoader } from '#src/modules/workflow/application/run-loader/RunLoader.ts';

/** What one approval phrase in a message led to. */
export type ApprovalOutcome = { readonly run: string; readonly gate: string; readonly recorded: boolean; readonly why?: string };

/** Records the gate decisions in a human's own message for runs whose gate is open (WG-28). Never blocks the message. */
export class RecordApproval {
  readonly #loader: RunLoader;
  readonly #runs: RunRepository;
  readonly #clock: Clock;

  /**
   * @param loader - loads each run named in the message
   * @param runs - appends the human line
   * @param clock - the line's time
   */
  public constructor(loader: RunLoader, runs: RunRepository, clock: Clock) {
    this.#loader = loader;
    this.#runs = runs;
    this.#clock = clock;
  }

  /**
   * @param project - the folder the session works in
   * @param text - the message exactly as typed
   * @param from - the hook event, session id and session log of the message
   * @returns one outcome per approval phrase; empty when the message has none
   */
  public async run(project: string, text: string, from: ApprovalSource): Promise<ApprovalOutcome[]> {
    const outcomes: ApprovalOutcome[] = [];
    for (const approval of Approval.allIn(text)) {
      const loaded = await this.#loader.load(project, approval.run);
      if (!loaded.ok || !loaded.value.exists) {
        outcomes.push({ run: approval.run, gate: approval.gate, recorded: false, why: loaded.ok ? 'no ledger' : loaded.error });
        continue;
      }
      const approved = loaded.value.run.approve(approval, from, this.#clock.now());
      if (approved.ok) await this.#runs.append(project, approval.run, approved.value.entry.toJsonLine());
      outcomes.push(approved.ok ? { run: approval.run, gate: approval.gate, recorded: true } : { run: approval.run, gate: approval.gate, recorded: false, why: approved.error });
    }
    return outcomes;
  }
}
