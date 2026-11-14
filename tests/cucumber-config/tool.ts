// The Cucumber configuration itself (specs/022 T042). It registers no tool: its job is to prove that a tool.ts loads
// by Node type stripping, which a scenario of tests/cucumber-config/cucumber-config.feature then observes.
export const loadedAs: string = 'tool.ts';
(globalThis as { toolTsLoaded?: boolean }).toolTsLoaded = true;
