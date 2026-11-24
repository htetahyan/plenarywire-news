// Model-provider interface. Only no-cost local providers are implemented.
// A provider must implement: name, async draft({ item, source, budget }) -> { text, tokensUsed }.
// Any other provider name fails closed: there is NO paid API integration in this repo.

export const stubProvider = {
  name: 'stub',
  async draft({ item, source }) {
    const text = [
      '> STUB DRAFT — no model was called. A human editor must write this item.',
      '',
      `Discovery candidate from ${source.name} (${source.tier}; ${source.mode}).`,
      `Official/source statements are attributed claims, not verified facts.`,
      '',
      '## What happened (to be written by an editor from the linked primary source)',
      '- TODO',
      '## Why it matters (Analysis — editor)',
      '- TODO',
      "## What's confirmed / attributed / unknown",
      '- TODO: verify independently; outlets repeating one wire story count as one source.',
    ].join('\n');
    return { text, tokensUsed: 0 };
  },
};

export const noopProvider = {
  name: 'noop',
  async draft() {
    return { text: '', tokensUsed: 0 };
  },
};

const REGISTRY = { stub: stubProvider, noop: noopProvider };

export function getProvider(name) {
  const p = REGISTRY[name];
  if (!p) {
    throw new Error(`Provider "${name}" is not available. Only no-cost providers (${Object.keys(REGISTRY).join(', ')}) exist; connecting a paid model API requires separate approval.`);
  }
  return p;
}
