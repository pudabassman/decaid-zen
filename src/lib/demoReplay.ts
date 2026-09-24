const KEY = 'demoReplayPending'

/** Reloads the page past the cache so a replay always runs the newest build. */
export function reloadThenReplay(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* a private window still reloads, it just will not auto-start */
  }
  const url = new URL(window.location.href)
  url.searchParams.set('v', String(Date.now()))
  window.location.replace(url.toString())
}

export function consumePendingReplay(): boolean {
  try {
    if (sessionStorage.getItem(KEY) !== '1') return false
    sessionStorage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}
