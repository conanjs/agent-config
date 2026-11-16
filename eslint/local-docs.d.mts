import type { Rule } from 'eslint';

declare const plugin: {
  meta: { name: string };
  rules: Record<'implementation-summary' | 'specific-summary', Rule.RuleModule>;
};
export default plugin;
