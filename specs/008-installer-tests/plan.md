# Implementation Plan: Executable scenarios for the bash installers

**Branch**: `feat/spec-kit-validator-tests` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

A fixture repo with a five-entry `mapping.yaml` and its sources, an empty `home/`. The Background copies the real `installers/` into it and puts a fake `uname` first on PATH. New shared steps: copy a repo folder, fake a command, make a symlink, and check symlinks, file contents and absence afterwards. No script changes.

## Project Structure

```text
tests/installers/
├── tool.mjs                 # bash repo/installers/<script>, HOME={root}/home, PATH={root}/bin:…
├── installers.feature
└── fixtures/base/{repo/{mapping.yaml, copilot/knowledge/, claude/, skills/}, home/}
tests/support/steps.mjs      # + copy repo folder, fake command, symlink and file-state steps
```
