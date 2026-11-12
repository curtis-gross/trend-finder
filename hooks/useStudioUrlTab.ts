const STUDIO_URL_TAB_EVENT = 'studio-url-tab-change';

export function syncStudioUrlParams(params: { mode?: string; tab?: string | null }): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  let changed = false;

  if (params.mode !== undefined) {
    const currentMode = url.searchParams.get('mode');
    if (params.mode) {
      if (currentMode !== params.mode) {
        url.searchParams.set('mode', params.mode);
        changed = true;
      }
    } else if (currentMode !== null) {
      url.searchParams.delete('mode');
      changed = true;
    }
  }

  if (params.tab !== undefined) {
    const currentTab = url.searchParams.get('tab');
    if (params.tab) {
      if (currentTab !== params.tab) {
        url.searchParams.set('tab', params.tab);
        changed = true;
      }
    } else if (currentTab !== null) {
      url.searchParams.delete('tab');
      changed = true;
    }
  }

  if (changed) {
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  window.dispatchEvent(new CustomEvent(STUDIO_URL_TAB_EVENT, { detail: params }));
}
