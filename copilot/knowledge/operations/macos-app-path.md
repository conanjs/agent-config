---
schema: knowledge-doc/v1
type: how-to
topic: operations
status: draft
applies-to: ["macOS 26.1", "VS Code 1.143.0", "nvm-installed Node"]
last-verified: 2026-11-05
last-updated: 2026-11-05
tags: [macos, path, launchctl, launchagent, vscode, nvm, node, hooks]
---

# Node on the PATH of macOS apps opened from the Dock

## Summary
**TL;DR:** An app opened from the Dock gets macOS's own PATH (`/usr/bin:/bin:/usr/sbin:/sbin`), not your shell's, so nvm's `node` is missing for it and for the hooks and MCP servers it starts. VS Code works around this by reading your shell's environment at startup, but falls back to the bare PATH when that takes over 10 seconds. A LaunchAgent that runs `launchctl setenv PATH …` did not reach VS Code; the supported way to set the PATH for apps is `sudo launchctl config user path …` and a reboot.
**Use this when:** a GUI app, or a hook or MCP server it starts, fails with `node: command not found` while `node` works in your terminal.
**Not this doc:** Copilot hook behaviour in VS Code → `../ai-agents/copilot-usage-reference.md`.

## Goal & prerequisites
- **End state:** every app opened from the Dock finds `node`, `npm` and `npx` (nvm's default version), and a terminal still uses whatever nvm selects.
- **Needs:** an admin account (for `sudo`), a reboot, and Node installed with nvm (nvm loads only from `~/.zshrc`, so only interactive shells see it).

## Steps
1. Create a launcher that runs nvm's default Node, so the PATH entry survives nvm upgrades: `~/.local/share/node-fallback/bin/node` (a shell script that picks `~/.nvm/alias/default`, else the newest `~/.nvm/versions/node/v*/bin`, and `exec`s the binary named like itself), plus `npm` and `npx` as symlinks to it. In agent-config this was installed by `/tmp/install-node-path.sh` on 2026-11-05.
2. Set the PATH for the user's launchd domain, with the launcher folder last so a shell's own nvm PATH still wins:
   ```sh
   sudo launchctl config user path "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/share/node-fallback/bin"
   ```
3. Reboot (required for `launchctl config` changes, per its man page).
4. Reopen VS Code from the Dock.

## Verify
- `env -i HOME="$HOME" PATH="/usr/bin:/bin:$HOME/.local/share/node-fallback/bin" /bin/bash -c 'node --version'` prints nvm's default version (`v24.22.1` on 2026-11-05) ✅[^3].
- After the reboot, VS Code's main process has the new PATH: `ps -E -o command= -p "$(pgrep -f 'Visual Studio Code.app/Contents/MacOS/Code' | head -1)" | grep -o ' PATH=[^ ]*'` shows `…/node-fallback/bin` ⚠️ unverified (the reboot had not happened when this was written).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| A hook started by VS Code fails with `/bin/bash: node: command not found` | VS Code did not get the shell's environment. Opened from the Dock, it runs the shell's startup files to read it, and after `application.shellEnvironmentResolutionTimeout` (10 seconds by default) starts without it ✅[^1]. VS Code's log then has "Unable to resolve your shell environment in a reasonable time" (seen 2026-10-26; hooks failed so on 2026-11-02 and 2026-11-03) ✅[^3] | Steps above; or quit and reopen VS Code, which usually resolves the environment in time (zsh started in 0.4 s on 2026-11-05) ✅[^3] |
| VS Code's main process PATH is `/usr/bin:/bin:/usr/sbin:/sbin` | That is the PATH macOS gives an app opened from the Dock; VS Code passes the resolved shell PATH only to the processes it starts (its Copilot runtime had nvm's `bin` on 2026-11-05) ✅[^3] | Nothing to fix when the helpers have the shell PATH |
| A LaunchAgent running `launchctl setenv PATH …` at login has no effect on VS Code | `setenv` sets a variable for "future processes launched by launchd in the caller's context" ✅[^2]; VS Code reopened from the Dock at 08:26:16, after the LaunchAgent set the PATH at 08:25:02, still had the bare PATH ✅[^3] | Use `launchctl config user path` (step 2), which the man page scopes to exactly the PATH ✅[^2] |

## Rollback
- `sudo launchctl config user path "/usr/bin:/bin:/usr/sbin:/sbin"`, then reboot.
- `rm -r ~/.local/share/node-fallback`.

## Takeaways
- A Dock-opened app never reads `~/.zshrc`: anything it must start (hooks, MCP servers) should find its interpreter itself or rely on `launchctl config user path`. [rule-candidate]
- `launchctl setenv PATH` is not a way to give Dock-opened apps a PATH.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 8 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-05

## References
- [Resolving shell environment fails (VS Code FAQ)](https://code.visualstudio.com/docs/supporting/faq#_resolving-shell-environment-fails) — Microsoft, living. Backs: VS Code opened from the Dock resolves the shell environment and starts without it after `application.shellEnvironmentResolutionTimeout` (10 seconds). [^1]
- `man launchctl` on macOS 26.1 — Apple, read 2026-11-05. Backs: `config user path` sets the PATH for all services in the user domain and needs a reboot; `setenv` applies to future processes launched by launchd in the caller's context. [^2]
- Local test on this Mac, 2026-11-05: VS Code 1.143.0 process environments (`ps -E`), its log folder `~/Library/Application Support/Code/logs/`, the Copilot session logs `~/.copilot/session-state/*/events.jsonl` (hook errors), zsh start time (`time zsh -l -i -c exit`), the launcher in a bare environment, and the LaunchAgent `~/Library/LaunchAgents/local.path-env.plist` (installed 08:25:02) against VS Code reopened at 08:26:16. [^3]
- [nvm README](https://github.com/nvm-sh/nvm#installing-and-updating) — nvm project, living. Backs: nvm is loaded by lines its installer adds to the shell profile.

## Related
- `ai-agents/copilot-usage-reference.md` — VS Code hooks run with the PATH of the Copilot runtime.
- `nodejs/node-nvm-corepack-pnpm-yarn-architecture.md` — Node version managers (legacy).
- `gcp/gke-lens-setup.md` — another GUI app (Lens) that needs a tool on the app PATH (legacy).
