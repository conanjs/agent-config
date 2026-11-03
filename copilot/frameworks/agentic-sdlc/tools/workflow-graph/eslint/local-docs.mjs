// Documentation rules no published plugin has (TSN-13). Copied into each repo as one file.
//
// specific-summary (CMT-13): a doc summary must say more than the names around it. `jsdoc/informative-docs` compares a
// summary with its own symbol only, so `/** Applies one revision. */` on `ReviseDocument.run` passes it. This
// rule also removes the words of the enclosing class or interface and fails when fewer than `minWords`
// content words are left. It is a floor, not a judge: a long summary can still be vague (llm, RUB-10).

const stopWords = new Set(
  (
    "a an the this that these those it its one some any each every of to in on at by for from with as " +
    "and or but if is are be been was were has have had do does did not no its their our your " +
    "given new current all only into onto via per"
  ).split(" "),
);

/**
 * Splits identifiers such as `ReviseDocument` or `expectedVersion` into lower-case words.
 *
 * @param name - An identifier, or `undefined` when the node has none.
 * @returns The words, empty when `name` is `undefined`.
 */
const wordsOf = (name) =>
  name === undefined
    ? []
    : name
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

// Five letters catch the usual inflections: revise / revision / revised, document / documents.
const stem = (word) => word.slice(0, 5);

/**
 * Returns the summary: the doc-comment text before the first block tag, cut at the first sentence end.
 *
 * @param comment - The raw `/** … *\/` comment value, without the delimiters.
 * @returns The first sentence, with inline tags reduced to their target name.
 */
const summaryOf = (comment) => {
  const lines = [];
  for (const raw of comment.split("\n")) {
    const line = raw.replace(/^\s*\*?\s?/, "");
    if (line.startsWith("@")) break;
    if (line.trim() === "" && lines.length > 0) break;
    lines.push(line);
  }
  const text = lines.join(" ").replace(/\{@\w+\s+([^}|\s]+)[^}]*\}/g, "$1");
  return text.split(/\.(\s|$)/)[0].trim();
};

/**
 * Returns the names a reader already sees at the declaration: the member and its class or interface.
 *
 * @param node - A method, method signature or function declaration.
 * @returns Every identifier word in scope, possibly empty.
 */
const namesAround = (node) => {
  const names = [node.key?.name, node.id?.name];
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      ["ClassDeclaration", "ClassExpression", "TSInterfaceDeclaration"].includes(parent.type) &&
      parent.id
    )
      names.push(parent.id.name);
  }
  return names.flatMap(wordsOf);
};

// implementation-summary (CMT-12): a method that implements an interface member gets its own summary,
// linking the contract it fulfils and saying what this implementation adds. Measured on TypeScript 6.0:
// the editor shows `{@inheritDoc X.y}` as literal text, so an adapter documented that way has no visible
// summary; and it copies the interface's @param/@returns only while the method's comment has no block
// tag at all, so extra failures go in the summary sentence, not in @throws.
const implementationSummary = {
  meta: {
    type: "suggestion",
    docs: { description: "Implementations have their own summary that links their contract" },
    schema: [],
    messages: {
      inheritDoc:
        "Editors show {@inheritDoc} as raw text. Write this implementation's own summary and link {@link {{contract}}} (CMT-12).",
      noLink: "Link the contract this method fulfils: {@link {{contract}}} (CMT-12).",
      blockTag:
        "A block tag ({{tag}}) stops the editor showing {{contract}}'s @param/@returns; say it in the summary (CMT-12).",
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    const checker = services?.program?.getTypeChecker();
    // Returns the name of the implemented interface that declares `member`, or undefined.
    const contractOf = (classNode, member) => {
      for (const clause of classNode.implements ?? []) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(clause);
        if (checker.getTypeAtLocation(tsNode).getProperty(member) !== undefined)
          return context.sourceCode.getText(clause.expression);
      }
      return undefined;
    };
    return {
      "ClassDeclaration[implements.length>0] > ClassBody > MethodDefinition[kind='method']"(node) {
        if (checker === undefined || node.static || node.key.type !== "Identifier") return;
        if (node.accessibility === "private" || node.accessibility === "protected") return;
        const iface = contractOf(node.parent.parent, node.key.name);
        if (iface === undefined) return;
        const contract = `${iface}.${node.key.name}`;
        const comment = context.sourceCode
          .getCommentsBefore(node)
          .findLast((c) => c.type === "Block" && c.value.startsWith("*"));
        if (comment === undefined) return; // jsdoc/require-jsdoc reports it
        const report = (messageId, data = {}) =>
          context.report({ loc: comment.loc, messageId, data: { contract, ...data } });
        if (comment.value.includes("@inheritDoc")) return report("inheritDoc");
        if (!new RegExp(`\\{@link\\s+${contract.replace(".", "\\.")}\\b`).test(comment.value))
          return report("noLink");
        const tag = comment.value.match(/^\s*\*?\s*(@\w+)/m)?.[1];
        if (tag !== undefined) report("blockTag", { tag });
      },
    };
  },
};

export default {
  meta: { name: "local-docs" },
  rules: {
    "implementation-summary": implementationSummary,
    "specific-summary": {
      meta: {
        type: "suggestion",
        docs: { description: "Doc summaries add facts beyond the member and type names" },
        schema: [
          {
            type: "object",
            properties: { minWords: { type: "integer", minimum: 1 } },
            additionalProperties: false,
          },
        ],
        messages: {
          vague:
            "Summary '{{summary}}' restates the names. Say the effect, condition, destination or failure (CMT-13).",
        },
      },
      create(context) {
        const minWords = context.options[0]?.minWords ?? 3;
        const check = (node) => {
          if (node.kind === "get" || node.kind === "set") return;
          const anchor = node.parent?.type === "ExportNamedDeclaration" ? node.parent : node;
          const comment = context.sourceCode
            .getCommentsBefore(anchor)
            .findLast((c) => c.type === "Block" && c.value.startsWith("*"));
          if (comment === undefined || comment.value.includes("@inheritDoc")) return;

          const summary = summaryOf(comment.value);
          const known = new Set(namesAround(node).map(stem));
          const content = wordsOf(summary).filter((w) => !stopWords.has(w) && !known.has(stem(w)));
          if (content.length < minWords)
            context.report({ loc: comment.loc, messageId: "vague", data: { summary } });
        };
        return {
          MethodDefinition: check,
          TSMethodSignature: check,
          FunctionDeclaration: check,
        };
      },
    },
  },
};
