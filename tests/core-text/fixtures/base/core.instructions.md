---
name: Core
description: Stand-in for the core instructions, with every rule of AC-9.8, AC-6.5 and AC-4.8 met
---

# Working agreements
- `{{AGENT_HOME}}` is the folder the installer puts agent files in.
- Start every response by greeting the user as "V".
- Agents never run `add`, `use` or an approval taken from a NEEDS report without V's approval in chat.

# Read the named file first when
- A doc has `{{VAR}}` placeholders (`{{AGENT_HOME}}`, `{{AGENT_CONFIG_REPO}}`, `{{LANGUAGE}}`): resolve them from `{{AGENT_HOME}}/global-variables.md`, read the resolved file on this machine and never fetch it; never guess.
- A neutral closing line.
