// world.mjs — one World per scenario: a fresh temp folder (this.root), the tool under test, and its last result.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { After, Before, setWorldConstructor, World } from '@cucumber/cucumber';

class ToolWorld extends World {
  // Real path: on macOS the temp folder sits behind a symlink (/var → /private/var), and tools that resolve real
  // paths would otherwise print a path the {root} placeholder does not match.
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tool-test-')));
  /** @type {string | undefined} */ toolName;
  /** @type {{ code: number, out: string } | undefined} */ result;
  /** @type {{ srv: import('node:http').Server, url: string } | undefined} */ server;
  /** Scenario names of the feature this scenario belongs to (for the coverage steps). */
  scenarioNames = [];

  /** Absolute path of a path relative to this scenario's temp folder. */
  at(p) {
    return path.join(this.root, p);
  }
}

setWorldConstructor(ToolWorld);

Before(function ({ gherkinDocument }) {
  this.scenarioNames = gherkinDocument.feature.children.map((c) => c.scenario?.name).filter(Boolean);
});

After(function () {
  fs.rmSync(this.root, { recursive: true, force: true });
  this.server?.srv.close();
});
