// The one rule table of the citation classifier (specs/022 T056, QA 5.2): the locations and the cases every consumer must classify
// the same way. The unit test of citations.ts runs it now; the dry run (T075), `build cite` and the renderer run the same table
// through their own entry points, so the three cannot drift (TR-6). A row changes only together with slots-v1.md.
import type { Citation, LocationRule } from './citations.ts';

/** The mounts of the shipped `slots.yaml` (slots-v1.md), plus the generated `global-variables.md`, which is a core export. */
export const sharedLocationRules: readonly LocationRule[] = [
  { slot: 'core', location: 'core', mount: 'core' },
  { slot: 'core', location: 'instructions', mount: 'instructions' },
  { slot: 'core', location: 'patterns', mount: 'patterns' },
  { slot: 'core', location: 'procedures', mount: 'procedures' },
  { slot: 'core', location: 'references', mount: 'references' },
  { slot: 'core', location: 'atlas', mount: 'atlas' },
  { slot: 'core', location: 'tracker', mount: 'tracker' },
  { slot: 'core', location: 'agent-foundry', mount: 'frameworks/agent-foundry' },
  { slot: 'core', location: 'global-variables', mount: 'global-variables.md' },
  { slot: 'knowledge-storage', location: 'content', mount: 'knowledge' },
  { slot: 'knowledge-storage', location: 'framework', mount: 'frameworks/knowledge' },
  { slot: 'knowledge-storage', location: 'company-kb-framework', mount: 'frameworks/company-kb' },
  { slot: 'company-knowledge-storage', location: 'content', mount: 'companies' },
  { slot: 'framework', location: 'framework', mount: 'frameworks/{component}' },
];

/** What a row expects: a classification, or a failure with its code and the path its message must name. */
export type ExpectedCitation =
  | { readonly ok: true; readonly citation: Citation }
  | { readonly ok: false; readonly code: string; readonly path: string };

/** One row of the table: the link text and what every consumer must make of it. */
export interface CitationCase {
  /** What the row shows, as a sentence. */
  readonly title: string;
  /** The link text exactly as written in a source file. */
  readonly text: string;
  /** The result all consumers expect. */
  readonly expected: ExpectedCitation;
}

function located(slot: string, location: string, mount: string, path: string, component?: string): ExpectedCitation {
  return { ok: true, citation: { kind: 'location', slot, location, mount, component, path } };
}

const own = (path: string): ExpectedCitation => ({ ok: true, citation: { kind: 'own', path } });
const fails = (code: string, path: string): ExpectedCitation => ({ ok: false, code, path });

const home = '{{AGENT_HOME}}';

/** The rows of the table, in the order the QA plan lists them (decisions/qa.md 5.2) and then the edge cases. */
export const citationCases: readonly CitationCase[] = [
  {
    title: 'a doc in the knowledge content location',
    text: `${home}/knowledge/a.md`,
    expected: located('knowledge-storage', 'content', 'knowledge', 'a.md'),
  },
  {
    title: 'a nested doc keeps its folders',
    text: `${home}/knowledge/a/b.md`,
    expected: located('knowledge-storage', 'content', 'knowledge', 'a/b.md'),
  },
  {
    title: 'a doc of a core location',
    text: `${home}/atlas/schemas/atlas.schema.md`,
    expected: located('core', 'atlas', 'atlas', 'schemas/atlas.schema.md'),
  },
  {
    title: 'the core folder of another mount name that has a slash',
    text: `${home}/frameworks/agent-foundry/x.md`,
    expected: located('core', 'agent-foundry', 'frameworks/agent-foundry', 'x.md'),
  },
  {
    title: 'the longer mount frameworks/knowledge wins over the {component} mount of the same length',
    text: `${home}/frameworks/knowledge/index.md`,
    expected: located('knowledge-storage', 'framework', 'frameworks/knowledge', 'index.md'),
  },
  {
    title: 'frameworks/company-kb is the framework of the knowledge provider',
    text: `${home}/frameworks/company-kb/index.md`,
    expected: located('knowledge-storage', 'company-kb-framework', 'frameworks/company-kb', 'index.md'),
  },
  {
    title: 'a framework component takes the {component} mount and names the component',
    text: `${home}/frameworks/agentic-sdlc/index.md`,
    expected: located('framework', 'framework', 'frameworks/agentic-sdlc', 'index.md', 'agentic-sdlc'),
  },
  {
    title: 'a company entry is under the shared companies location',
    text: `${home}/companies/ots/index.md`,
    expected: located('company-knowledge-storage', 'content', 'companies', 'ots/index.md'),
  },
  {
    title: 'global-variables.md is a core export, not a folder mount',
    text: `${home}/global-variables.md`,
    expected: located('core', 'global-variables', 'global-variables.md', ''),
  },
  {
    title: 'the mount itself has an empty rest',
    text: `${home}/knowledge`,
    expected: located('knowledge-storage', 'content', 'knowledge', ''),
  },
  {
    title: 'a trailing slash on the mount has an empty rest',
    text: `${home}/knowledge/`,
    expected: located('knowledge-storage', 'content', 'knowledge', ''),
  },
  {
    title: 'spaces and non-ASCII letters in the rest are kept as written',
    text: `${home}/knowledge/Vinh Đỗ/a b.md`,
    expected: located('knowledge-storage', 'content', 'knowledge', 'Vinh Đỗ/a b.md'),
  },
  { title: 'a bare relative path is the component own file', text: 'x.md', expected: own('x.md') },
  {
    title: 'a bare relative path with a parent step is the component own file',
    text: '../x.md',
    expected: own('../x.md'),
  },
  {
    title: 'a bare relative path with a space is the component own file',
    text: './notes/a b.md',
    expected: own('./notes/a b.md'),
  },
  {
    title: 'a path under no location fails and names the path',
    text: `${home}/nope/x.md`,
    expected: fails('under-no-location', 'nope/x.md'),
  },
  {
    title: 'a folder whose name only starts like a mount is under no location',
    text: `${home}/knowledgebase/x.md`,
    expected: fails('under-no-location', 'knowledgebase/x.md'),
  },
  {
    title: 'a {component} segment that is not an id matches nothing',
    text: `${home}/frameworks/Bad_Name/x.md`,
    expected: fails('under-no-location', 'frameworks/Bad_Name/x.md'),
  },
  {
    title: 'frameworks alone is under no location',
    text: `${home}/frameworks`,
    expected: fails('under-no-location', 'frameworks'),
  },
  {
    title: 'a .. segment fails, so a citation cannot leave its mount',
    text: `${home}/knowledge/../secrets.md`,
    expected: fails('unsafe-path', 'knowledge/../secrets.md'),
  },
  { title: 'a . segment fails', text: `${home}/knowledge/./a.md`, expected: fails('unsafe-path', 'knowledge/./a.md') },
  {
    title: 'an empty segment fails',
    text: `${home}//knowledge/a.md`,
    expected: fails('unsafe-path', '/knowledge/a.md'),
  },
  { title: 'the placeholder alone fails', text: `${home}/`, expected: fails('unsafe-path', '') },
  {
    title: 'a placeholder segment such as <co> is not a citation (A-24)',
    text: `${home}/companies/<co>/index.md`,
    expected: { ok: true, citation: { kind: 'placeholder', path: 'companies/<co>/index.md' } },
  },
  {
    title: 'an absolute path is not a citation',
    text: '/etc/passwd',
    expected: fails('not-a-citation', '/etc/passwd'),
  },
  {
    title: 'a Windows path is not a citation',
    text: 'C:\\Users\\v\\x.md',
    expected: fails('not-a-citation', 'C:\\Users\\v\\x.md'),
  },
  {
    title: 'a home-relative path is not a citation',
    text: '~/.copilot/x.md',
    expected: fails('not-a-citation', '~/.copilot/x.md'),
  },
  {
    title: 'a web address is not a citation',
    text: 'https://example.com/x.md',
    expected: fails('not-a-citation', 'https://example.com/x.md'),
  },
  { title: 'an empty text fails', text: '', expected: fails('empty', '') },
];
