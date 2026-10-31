// prices.mjs — the rates turn-tokens.mjs prices calls with (turn-tokens/v1, TT-9). Update the rows and the date
// together when a pricing page changes.
//
// Anthropic: US dollars per million tokens, written as integer micro-dollars (1 = $0.000001) so sums stay exact.
//   Read 2026-10-31 from https://platform.claude.com/docs/en/about-claude/pricing (Model pricing; Fast mode).
//   Columns: input, 5-minute cache write, 1-hour cache write, cache read, output.
//   fast: the fast-mode input and output price; the cache multipliers apply on top of it.
//   over100k: Haiku 5.5's rates for prompts over 100,000 tokens. residency: 1.1× for inference_geo "us" (4.6 and later).
// Codex: credits per million tokens, written as integer milli-credits. Read 2026-10-31 from
//   https://learn.chatgpt.com/docs/pricing (Token rates, Standard speed); Fast mode bills credits at 2×
//   (https://learn.chatgpt.com/docs/agent-configuration/speed). Slugs other than gpt-6-astra and gpt-6.1-sol are the
//   display names lowercased with hyphens, not yet seen in a log.

const usd = (input, write5m, write1h, read, output, extra = {}) =>
  ({ input: input * 1e6, write5m: write5m * 1e6, write1h: write1h * 1e6, read: read * 1e6, output: output * 1e6, residency: true, ...extra });
const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v]));

const opus5 = usd(5, 6.25, 10, 0.5, 25, { fast: { input: 10e6, output: 50e6 } });
const opus4x = usd(5, 6.25, 10, 0.5, 25);

export const anthropic = {
  'claude-fable-5-1': usd(10, 12.5, 20, 0.25, 50),
  'claude-mythos-5-1': usd(10, 12.5, 20, 0.25, 50),
  'claude-fable-5': usd(10, 12.5, 20, 1, 50),
  'claude-mythos-5': usd(10, 12.5, 20, 1, 50),
  'claude-opus-5-5': usd(4, 5, 8, 0.2, 20, { fast: { input: 8e6, output: 40e6 } }),
  'claude-opus-5': opus5,
  'claude-opus-4-8': { ...opus5 },
  'claude-opus-4-7': opus4x,
  'claude-opus-4-6': opus4x,
  'claude-opus-4-5': { ...opus4x, residency: false },
  'claude-sonnet-5-5': usd(2, 2.5, 4, 0.1, 10),
  'claude-sonnet-5': usd(2, 2.5, 4, 0.2, 10),
  'claude-sonnet-4-6': usd(3, 3.75, 6, 0.3, 15),
  'claude-sonnet-4-5': usd(3, 3.75, 6, 0.3, 15, { residency: false }),
  'claude-haiku-5-5': usd(0.1, 0.125, 0.2, 0.01, 0.5, { over100k: round(usd(0.5, 0.625, 1, 0.05, 2.5)) }),
  'claude-haiku-4-5': usd(1, 1.25, 2, 0.1, 5, { residency: false }),
};
for (const k of Object.keys(anthropic)) anthropic[k] = round(anthropic[k]);

const credits = (input, cached, output) => ({ input: Math.round(input * 1000), cached: Math.round(cached * 1000), output: Math.round(output * 1000) });

export const codex = {
  'gpt-6-astra': credits(250, 25, 1250),
  'gpt-6.1-sol': credits(50, 2.5, 250),
  'gpt-6.1-terra': credits(25, 1.25, 125),
  'gpt-6-sol': credits(50, 5, 250),
  'gpt-6-luna': credits(2.5, 0.25, 12.5),
  'gpt-5.6-sol': credits(100, 10, 500),
};
export const codexFastTiers = ['fast', 'priority'];
