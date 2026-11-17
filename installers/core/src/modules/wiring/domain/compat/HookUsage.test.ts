// M-14: a hook command names a path however it is spelled; the check reads text and resolves nothing on disk.
import { describe, expect, it } from 'vitest';
import { COPILOT_FOLDER } from '#wiring/domain/compat/CompatLinks.ts';
import { textNamesPath } from '#wiring/domain/compat/HookUsage.ts';

const target = `/h/${COPILOT_FOLDER}/knowledge`;
const names = (text: string): boolean => textNamesPath(text, target);
const tilde = `~/${COPILOT_FOLDER}`;
const folder = COPILOT_FOLDER;

describe('M-14 spellings of the path in a hook command', () => {
  it.each([
    ['a tilde path', `bash ${tilde}/knowledge/guard.sh`],
    ['the folder itself', `ls ${tilde}/knowledge`],
    ['$HOME', `bash $HOME/${folder}/knowledge/guard.sh`],
    ['${HOME}', `bash \${HOME}/${folder}/knowledge/guard.sh`],
    ['a quoted $HOME with the path after the quote', `bash "$HOME"/${folder}/knowledge/guard.sh`],
    ['a single-quoted home', `bash '$HOME'/${folder}/knowledge/guard.sh`],
    ['${HOME:-x}', `bash \${HOME:-x}/${folder}/knowledge/guard.sh`],
    ['~user', `bash ~root/${folder}/knowledge/guard.sh`],
    ['the absolute home', `bash /h/${folder}/knowledge/guard.sh`],
    ['a firmlink path to the home', `bash /System/Volumes/Data/Users/v/${folder}/knowledge/guard.sh`],
    ['upper case users folder', `bash /USERS/V/${folder}/knowledge/guard.sh`],
    [
      'another letter case in the names',
      `bash ~/.${folder.slice(1).replace(/^./, (letter) => letter.toUpperCase())}/Knowledge/guard.sh`,
    ],
    ['a quote inside a name', `bash ${tilde}/know""ledge/guard.sh`],
    ['a single quote inside a name', `bash ${tilde}/kno''wledge/guard.sh`],
    ['a backslash escape inside a name', `bash ${tilde}/know\\ledge/guard.sh`],
    ['a dot segment', `bash ${tilde}/./knowledge/guard.sh`],
    ['a double separator', `bash ${tilde}//knowledge/guard.sh`],
    ['a parent segment', `bash ${tilde}/patterns/../knowledge/guard.sh`],
    ['a quote around the whole path', `bash "${tilde}/knowledge/guard.sh"`],
    ['an option value', `tool --dir=${tilde}/knowledge`],
    ['after a semicolon', `true;bash ${tilde}/knowledge/guard.sh`],
    ['inside JSON text', `{"command":"bash ${tilde}/knowledge/guard.sh"}`],
    ['a pipe', `cat ${tilde}/knowledge/x|sh`],
    ['a command substitution', `$(cat ${tilde}/knowledge/x)`],
    ['an unknown variable in front', `bash $SOMETHING/${folder}/knowledge/guard.sh`],
    ['a tilde in the middle of a word', `bash x~/${folder}/knowledge/a`],
  ])('finds %s', (_title, text) => {
    expect(names(text)).toBe(true);
  });

  it.each([
    ['another folder', `bash ${tilde}/patterns/guard.sh`],
    ['a sibling with the same start', `bash ${tilde}/knowledge-old/guard.sh`],
    ['the new agent home', 'bash /h/.agent-config/knowledge/guard.sh'],
    ['a relative path', 'bash knowledge/guard.sh'],
    ['no path at all', 'echo hello'],
    ['an empty text', ''],
    ['the parent only', `ls ${tilde}`],
    ['the folder name alone', 'ls knowledge'],
  ])('does not find %s', (_title, text) => {
    expect(names(text)).toBe(false);
  });
});

describe('M-14 on Windows', () => {
  const winTarget = `C:\\h\\${folder}\\knowledge`;
  const winNames = (text: string): boolean => textNamesPath(text, winTarget);
  it.each([
    ['the profile variable', `node %USERPROFILE%\\${folder}\\knowledge\\guard.mjs`],
    ['forward slashes', `node C:/h/${folder}/knowledge/guard.mjs`],
    ['another letter case', `node c:\\H\\${folder.toUpperCase()}\\Knowledge\\guard.mjs`],
    ['a tilde path', `node ${tilde}/knowledge/guard.mjs`],
    ['PowerShell', `node $env:USERPROFILE\\${folder}\\knowledge\\guard.mjs`],
  ])('finds %s', (_title, text) => {
    expect(winNames(text)).toBe(true);
  });
});
