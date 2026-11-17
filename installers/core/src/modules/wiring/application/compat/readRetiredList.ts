import { refuse, type Result } from '#shared/domain/result/Result.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import { decodeRetiredList, type RetiredEntry } from '#wiring/domain/compat/RetiredList.ts';
import type { YamlReader } from '#wiring/application/ports/YamlReader.ts';

/**
 * Reads the text of `compat.yaml` of the agent-config checkout through the hardened YAML reader.
 *
 * @param text - the whole file, or `undefined` when the checkout has none (a release that retires nothing)
 * @param readYaml - the hardened YAML reader
 * @param userHome - the user's home folder
 * @param flavor - the path syntax
 * @returns the retired entries, or one sentence for MG-23 that says why the file is refused (a refused file stops the run, exit 1)
 */
export function readRetiredList(
  text: string | undefined,
  readYaml: YamlReader,
  userHome: string,
  flavor: PathFlavor,
): Result<readonly RetiredEntry[], string> {
  if (text === undefined) return decodeRetiredList(undefined, userHome, flavor);
  const parsed = readYaml(text);
  if (!parsed.ok)
    return refuse(
      parsed.findings
        .map((finding) => (finding.line === undefined ? finding.message : `line ${finding.line}: ${finding.message}`))
        .join('; '),
    );
  return decodeRetiredList(parsed.value, userHome, flavor);
}
