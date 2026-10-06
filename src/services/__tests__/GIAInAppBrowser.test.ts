import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGiaStore } from '../../store/useGiaStore';

const { navigateMock, scrapeMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  scrapeMock: vi.fn(),
}));
vi.mock('../BrowserRunner', () => ({ default: { navigate: navigateMock } }));
vi.mock('../FallbackWebSearch', () => ({ default: { scrape: scrapeMock } }));

const { default: browser } = await import('../GIAInAppBrowser');

describe('GIAInAppBrowser web fallback', () => {
  beforeEach(() => {
    navigateMock.mockReset().mockResolvedValue({
      url: 'https://example.com/',
      title: 'Example',
      text: 'Read-only page content',
    });
    scrapeMock.mockReset().mockResolvedValue({
      url: 'https://example.com/',
      title: 'Example from reader',
      content: 'Retrieved through the fallback reader.',
      source: 'proxy',
    });
    useGiaStore.setState({
      inAppBrowser: { open: false, mode: 'reader', url: '', title: '', content: '', error: '', loading: false },
    });
  });

  it('opens a page in the read-only browser and stores extracted content', async () => {
    await expect(browser.navigate('https://example.com')).resolves.toEqual({
      url: 'https://example.com/',
      title: 'Example',
      text: 'Read-only page content',
    });
    expect(useGiaStore.getState().inAppBrowser).toMatchObject({
      open: true,
      mode: 'reader',
      url: 'https://example.com/',
      title: 'Example',
      content: 'Read-only page content',
      error: '',
    });
  });

  it('rejects non-web schemes before making a request', async () => {
    await expect(browser.navigate('javascript:alert(1)')).rejects.toThrow('Only HTTP and HTTPS URLs');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('falls back to the existing web reader when the browser fetch is blocked by CORS', async () => {
    navigateMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(browser.navigate('https://example.com')).resolves.toMatchObject({
      title: 'Example from reader',
      text: 'Retrieved through the fallback reader.',
    });
    expect(scrapeMock).toHaveBeenCalledWith('https://example.com/', 50000);
    expect(useGiaStore.getState().inAppBrowser).toMatchObject({
      title: 'Example from reader',
      content: 'Retrieved through the fallback reader.',
      error: '',
      loading: false,
    });
  });

  it('surfaces a clear error when the fallback reader also fails', async () => {
    navigateMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    scrapeMock.mockRejectedValueOnce(new Error('All proxies failed'));

    await expect(browser.navigate('https://example.com')).rejects.toThrow(
      'This site blocks direct browser reading, and the fallback reader could not retrieve it: All proxies failed',
    );

    expect(useGiaStore.getState().inAppBrowser).toMatchObject({
      content: '',
      error: 'This site blocks direct browser reading, and the fallback reader could not retrieve it: All proxies failed',
      loading: false,
    });
  });

  it('opens Build previews in the shared browser panel', async () => {
    await browser.openPreview('https://preview.example.com');
    expect(useGiaStore.getState().inAppBrowser).toMatchObject({
      open: true,
      mode: 'preview',
      url: 'https://preview.example.com/',
      title: 'Build preview',
    });
  });

  it('opens the browser shell before a URL is entered', async () => {
    await browser.open();
    expect(useGiaStore.getState().inAppBrowser).toMatchObject({
      open: true,
      mode: 'reader',
      url: '',
    });
  });

  it('keeps web interaction read-only', async () => {
    await expect(browser.click('button')).rejects.toThrow('web browser is read-only');
    await expect(browser.fill('#search', 'query', false)).rejects.toThrow('web browser is read-only');
    await expect(browser.scroll('down', 500)).rejects.toThrow('web browser is read-only');
  });
});
