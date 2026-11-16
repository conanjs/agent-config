import { makePrintable } from '#shared/domain/redaction/redactDeep.ts';
import { redact } from '#shared/domain/redaction/redact.ts';
import { MESSAGE_CATALOG, type MessageId } from '#shared/domain/messages/MessageCatalog.ts';

// The names between braces in a template, as a union: '{a} and {b}' gives 'a' | 'b'.
type PlaceholderNames<Template extends string> = Template extends `${string}{${infer Name}}${infer Rest}`
  ? Name | PlaceholderNames<Rest>
  : never;

/** The values a message needs, one string per placeholder of its row. */
export type MessageValues<Id extends MessageId> = Readonly<
  Record<PlaceholderNames<(typeof MESSAGE_CATALOG)[Id]>, string>
>;

const PLACEHOLDER = /\{([A-Za-z0-9]+)\}/g;

/**
 * Fills one row of the message catalogue, with credentials hidden (M-07) and control characters shown (M-11).
 *
 * Each VALUE is made printable before it is placed: a control or bidi character becomes a visible `\xNN` or `\uNNNN`, and a line
 * feed too, so a value can never print a new line, fake a prompt line or move the cursor. The finished text is redacted once more.
 * A multi-line value, such as git's standard error in `MG-32.cause`, therefore prints as one line.
 *
 * Each placeholder is replaced in a single pass, so a value that itself contains braces is printed as written. A value missing
 * at run time is a programming error and throws an error that names the message id and the placeholder, never a value.
 *
 * @param id - the catalogue row
 * @param values - one string per placeholder of the row
 * @returns the finished text, with credentials hidden
 */
export function renderMessage<Id extends MessageId>(id: Id, values: MessageValues<Id>): string {
  const given: Readonly<Record<string, string | undefined>> = values;
  const template: string = MESSAGE_CATALOG[id];
  return redact(
    template.replace(PLACEHOLDER, (_placeholder, name: string) => {
      const value = given[name];
      if (value === undefined) throw new Error(`message ${id} needs a value for {${name}}`);
      return makePrintable(value);
    }),
  );
}
