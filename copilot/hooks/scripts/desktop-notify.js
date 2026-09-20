#!/usr/bin/env node
/**
 * agentStop hook: fire a native desktop notification when the agent
 * finishes a turn. Best-effort — silently no-ops if there's no notifier
 * binary, no display server (e.g. headless/SSH), or an unsupported platform.
 */

'use strict';

const { execFileSync } = require('child_process');
const { getProjectName } = require('./lib/utils');

function notifyMac(title, message) {
  const escape = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  execFileSync(
    'osascript',
    ['-e', `display notification "${escape(message)}" with title "${escape(title)}" sound name "Glass"`],
    { stdio: 'ignore', timeout: 5000 }
  );
}

function notifyLinux(title, message) {
  execFileSync('notify-send', [title, message], { stdio: 'ignore', timeout: 5000 });
}

function notifyWindows(title, message) {
  const escape = (s) => s.replace(/'/g, "''");
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$n = New-Object System.Windows.Forms.NotifyIcon',
    '$n.Icon = [System.Drawing.SystemIcons]::Information',
    `$n.BalloonTipTitle = '${escape(title)}'`,
    `$n.BalloonTipText = '${escape(message)}'`,
    '$n.Visible = $true',
    '$n.ShowBalloonTip(4000)',
    'Start-Sleep -Seconds 4',
    '$n.Dispose()',
  ].join('; ');
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: 'ignore',
    timeout: 10000,
  });
}

try {
  const title = 'Copilot CLI';
  const message = `Turn finished in ${getProjectName() || 'this session'}`;

  if (process.platform === 'darwin') notifyMac(title, message);
  else if (process.platform === 'linux') notifyLinux(title, message);
  else if (process.platform === 'win32') notifyWindows(title, message);
} catch {
  // No notifier binary, no display server, or it timed out — non-blocking.
}

process.stdout.write('{}');
