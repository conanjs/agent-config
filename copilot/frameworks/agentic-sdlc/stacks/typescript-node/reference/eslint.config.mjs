// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";
import tseslint from "typescript-eslint";

// IMP-1, TSN-16: a relative path may name only a file in the importing file's own folder.
const noRelativeOutsideFolder = {
  regex: "^(\\.\\./|\\./[^/]+/)",
  message: "Use an @/ alias outside the file's own folder (IMP-1)",
};

// PDM-class-modeled-R7: free functions only in the Tier B files listed in docs/architecture.md §7.
const tierB = ["src/main.ts", "src/infrastructure/config.ts"];
const noFreeFunctions = [
  "Program > FunctionDeclaration",
  "Program > ExportNamedDeclaration > FunctionDeclaration",
  "Program > ExportDefaultDeclaration > FunctionDeclaration",
  "Program > VariableDeclaration > VariableDeclarator[init.type='ArrowFunctionExpression']",
].map((selector) => ({
  selector,
  message: "Tier A code is a class (PDM-class-modeled-R7)",
}));

// PDM-class-modeled-R1: domain state is readonly #fields. These must be repeated with the R7
// selectors because a later block's no-restricted-syntax options replace the earlier ones.
const domainState = [
  {
    selector: "PropertyDefinition[accessibility='private']",
    message: "Domain state uses readonly #fields (PDM-class-modeled-R1)",
  },
  {
    selector: "TSParameterProperty",
    message: "Domain state uses readonly #fields (PDM-class-modeled-R1)",
  },
  {
    selector: "PropertyDefinition:not([readonly=true])",
    message: "Domain state is readonly (PDM-class-modeled-R1)",
  },
];

// FF-1, TSN-17: layer direction from docs/architecture.md §4. Adapters are reachable only from the
// composition root (PDM-class-modeled-R9). Zones are resolved paths, so aliases cannot bypass them.
const layerZones = [
  {
    target: "./src/domain",
    from: ["./src/application", "./src/infrastructure", "./src/interface"],
  },
  {
    target: "./src/application",
    from: ["./src/infrastructure", "./src/interface"],
  },
  { target: "./src/infrastructure", from: ["./src/interface"] },
  { target: "./src/interface", from: ["./src/infrastructure"] },
  {
    target: "./src/!(CompositionRoot|main).ts",
    from: ["./src/CompositionRoot.ts", "./src/main.ts"],
  },
];

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "scripts/"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  { files: ["**/*.mjs"], ...tseslint.configs.disableTypeChecked },
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    plugins: { "import-x": importX },
    settings: {
      "import-x/extensions": [".ts", ".js"],
      "import-x/resolver-next": [createTypeScriptImportResolver({ project: "tsconfig.json" })],
    },
    rules: {
      "no-restricted-imports": ["error", { patterns: [noRelativeOutsideFolder] }],
      "import-x/no-cycle": "error",
      "no-console": "error",
      // Express recognises error middleware by its four parameters, so `_next` must stay.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-member-accessibility": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/no-extraneous-class": [
        "error",
        { allowWithDecorator: true, allowStaticOnly: false },
      ],
    },
  },
  {
    // Tests sit outside the layer graph: a use-case test may use the in-memory adapter as its fake.
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts"],
    rules: { "import-x/no-restricted-paths": ["error", { zones: layerZones }] },
  },
  {
    files: ["src/**/*.ts"],
    ignores: [...tierB, "src/**/*.test.ts"],
    rules: { "no-restricted-syntax": ["error", ...noFreeFunctions] },
  },
  {
    files: ["src/domain/**/*.ts"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...noFreeFunctions, ...domainState],
    },
  },
  {
    // TSN-13, CMT-5, CMT-12: TSDoc on every exported declaration and public member.
    files: ["src/**/*.ts", "test/support/**/*.ts"],
    ignores: ["src/**/*.test.ts"],
    plugins: { jsdoc, tsdoc },
    settings: { jsdoc: { mode: "typescript" } },
    rules: {
      "tsdoc/syntax": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            ClassDeclaration: true,
            MethodDefinition: true,
            FunctionDeclaration: true,
          },
          checkGetters: true,
          contexts: [
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "TSMethodSignature",
            "TSPropertySignature",
            "ExportNamedDeclaration > VariableDeclaration",
          ],
        },
      ],
      "jsdoc/informative-docs": "error",
    },
  },
  prettier,
);
