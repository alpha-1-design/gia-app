import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import ModelSwitcherSheet from '../ModelSwitcherSheet';
import { useProviderStore } from '../../../store/useProviderStore';
import { providerRegistry } from '../../../services/ProviderRegistry';

// The registry tries to enrich its fallback data with a remote provider
// config on first load. In tests that fetch hangs on slow CI / parallel runs
// and makes this suite flaky — stub it out so the deterministic fallback
// data (OpenAI provider, Gemma 3 27B model) is always used.
vi.mock('../../../services/CorsProxy', () => ({
  corsProxy: {
    fetch: vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({}) })
    ),
  },
}));

describe('ModelSwitcherSheet', () => {
  beforeEach(async () => {
    localStorage.clear();
    await providerRegistry.ensureLoaded();
    // Reset to a connected OpenRouter provider with a fetched, "live" model
    // list — this is the exact state in the bug report: a green "Live model
    // list from API" dot but no visible models.
    useProviderStore.setState({
      activeProvider: 'openrouter',
      providers: {
        openrouter: { apiKey: 'test-key', model: 'google/gemma-3-27b-it:free', enabled: true },
      },
      availableModels: {
        openrouter: providerRegistry.getModels('openrouter'),
      },
      modelListStatus: { openrouter: 'live' },
    });
  });

  it('renders the fetched model list somewhere the provider column cannot squeeze to zero width', () => {
    const { getByText, getAllByRole } = render(
      <ModelSwitcherSheet open={true} onClose={() => {}} />
    );

    // Sanity: we really are in the "live" state from the bug report.
    getByText('● Live model list from API');

    // The actual regression: before the fix, the model list, the refresh
    // bar, and the image-model input were three siblings in one flex ROW
    // alongside the provider column. Unshrinkable siblings (refresh bar,
    // text input) forced the model list — the only min-w-0 child — toward
    // zero width. Assert they now share a dedicated flex-column ancestor
    // that does NOT also contain a provider entry as a direct sibling.
    const refreshBtn = getByText('Refresh').closest('button')!;
    const modelBtn = getAllByRole('button').find(
      (b) => b.textContent?.includes('Gemma 3 27B')
    )!;
    expect(modelBtn).toBeTruthy();

    // Walk up from the refresh button to find the flex-column wrapper that
    // should contain both the refresh bar and the model list.
    let wrapper: HTMLElement | null = refreshBtn;
    while (wrapper && !wrapper.contains(modelBtn)) {
      wrapper = wrapper.parentElement;
    }
    expect(wrapper).toBeTruthy();

    // That shared wrapper must NOT also be an ancestor of a provider-column
    // entry (e.g. "OpenAI") — if it is, we've regressed to the old layout
    // where the model list was squeezed by unrelated siblings.
    const openAiEntry = getByText('OpenAI').closest('button')!;
    expect(wrapper!.contains(openAiEntry)).toBe(false);
  });

  it('does not render the model list and provider list as siblings in the same row', () => {
    const { getByText } = render(<ModelSwitcherSheet open={true} onClose={() => {}} />);
    const openAiEntry = getByText('OpenAI').closest('button')!;
    const refreshBar = getByText('● Live model list from API');

    // Common ancestor of the provider entry and the refresh bar is the
    // outer row. The refresh bar's immediate flex-column wrapper must be a
    // *child* of that row, not the row itself, so it never has to compete
    // with the provider column for width.
    const row = openAiEntry.closest('.flex.flex-1')!;
    expect(row).toBeTruthy();
    const refreshBarDirectRowChild = Array.from(row.children).includes(
      refreshBar.parentElement!.parentElement as Element
    );
    expect(refreshBarDirectRowChild).toBe(false);
  });
});
