import { asList, asMapping, asText } from '#manifests/domain/decode/Fields.ts';
import type { ComponentList, ComponentSource, ListEntry } from '#manifests/domain/model/ComponentList.ts';

function decodeSource(value: unknown): ComponentSource {
  const source = asMapping(value);
  const type = source['type'];
  if (type === 'path') return { type: 'path', path: asText(source['path']) };
  if (type === 'archive') return { type: 'archive', url: asText(source['url']), sha256: asText(source['sha256']) };
  return { type: 'git', url: asText(source['url']), ref: asText(source['ref']) };
}

function decodeEntry(value: unknown): ListEntry {
  const entry = asMapping(value);
  return { name: asText(entry['name']), source: decodeSource(entry['source']) };
}

/**
 * Turns a components-list/v1 document that the contract reader accepted into a list.
 *
 * @param document - the parsed, checked document
 * @returns the list with its entries in file order, marked present
 */
export function decodeList(document: Readonly<Record<string, unknown>>): ComponentList {
  return {
    local: document['local'] === true,
    entries: asList(document['components']).map(decodeEntry),
    present: true,
  };
}
