// signal-exit.ts — runs an installer entry as a child and turns "killed by SIGKILL" into exit code 137 (specs/022 T118).
// The shared steps report a child that a signal ended as exit code null; the kill fault of fault-adapters.ts sends SIGKILL on
// POSIX, so installerRunner starts entries through this launcher: `node signal-exit.ts <entry> <args>`. Everything else
// (output, stdin, other exit codes) passes through unchanged. Not in tests/support/*.ts on purpose: Cucumber imports those.
import { spawnSync } from 'node:child_process';

const [entry = '', ...args] = process.argv.slice(2);
const child = spawnSync(process.execPath, [entry, ...args], { stdio: 'inherit' });
process.exitCode = child.status ?? (child.signal === 'SIGKILL' ? 137 : 1);
