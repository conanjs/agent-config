// How the installer world of tests/support/installer-world.ts is shown to work before the installer exists (specs/022 T117, T118):
// the tool under test is a stand-in, tests/installer-world/stand-in.ts, that reads the same test settings as the real test
// entry will and drives stand-in ports through the fault adapter. "installer-production" names the production entry, for the
// scenario that proves it ignores every test variable (pending until the CompositionRoot task).
import { registerTool } from '../support/tools.mjs';
import { installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';

const fixture = 'tests/installer-world/fixtures/base';

registerTool('installer-world', {
  fixture,
  run: (world: InstallerWorld, extra: string[]) => installerRunner('tests/installer-world/stand-in.ts')(world, extra),
  quietPass: '',
  codes: () => [],
});

registerTool('installer-production', {
  fixture,
  run: (world: InstallerWorld, extra: string[]) => installerRunner('installers/core/main.ts')(world, extra),
  quietPass: '',
  codes: () => [],
});
