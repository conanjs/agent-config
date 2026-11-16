// A stand-in tool for tests/tools-support: prints what the shared support passes to a tool, and can write into HOME.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const [command, ...rest] = process.argv.slice(2);
const home = process.env.HOME;
if (command === 'home') console.log(`home=${home}`);
if (command === 'homedir') console.log(`homedir=${os.homedir()}`);
if (command === 'chmod') fs.chmodSync(path.join(home, 'old.txt'), 0o600);
if (command === 'read') console.log(fs.readdirSync(home).length);
if (command === 'write') fs.writeFileSync(path.join(home, 'new.txt'), 'x');
if (command === 'edit') fs.appendFileSync(path.join(home, 'old.txt'), 'y');
if (command === 'remove') fs.rmSync(path.join(home, 'old.txt'));
if (command === 'stamp') console.log('Backed up to 20261113101530 at 2026-11-13T10:15:30.123Z');
if (command === 'args') console.log(rest.join('|'));
if (command === 'fail') process.exit(3);
