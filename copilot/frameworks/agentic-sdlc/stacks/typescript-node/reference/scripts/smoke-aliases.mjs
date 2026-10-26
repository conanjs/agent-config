// TSN-15 smoke check: the built output must load with plain Node, which only works
// if tsc-alias rewrote every @/ alias into a relative path. Runs after the build,
// so it is one of the files outside the alias rule (docs/architecture.md §4).
await import("../dist/CompositionRoot.js");
process.stdout.write("dist/ loads: every alias was rewritten\n");
