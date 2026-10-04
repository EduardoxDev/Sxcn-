/**
 * Storage helpers that never throw (private mode, blocked storage, quota).
 * Per-tab secrets (resume token, host key) live in sessionStorage so that two tabs in the same
 * browser are two distinct participants, while a page refresh resumes the same seat.
 */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const session = {
  get: (key: string) => safe(() => window.sessionStorage.getItem(key), null),
  set: (key: string, value: string) =>
    safe(() => window.sessionStorage.setItem(key, value), undefined),
  remove: (key: string) => safe(() => window.sessionStorage.removeItem(key), undefined),
};

export const roomSecrets = {
  getResumeToken: (code: string) => session.get(`scxn:resume:${code}`) ?? undefined,
  setResumeToken: (code: string, token: string) => session.set(`scxn:resume:${code}`, token),
  clearResumeToken: (code: string) => session.remove(`scxn:resume:${code}`),
  // Host key is kept in localStorage too: the creator may open the room in another tab.
  getHostKey: (code: string) =>
    session.get(`scxn:host:${code}`) ??
    safe(() => window.localStorage.getItem(`scxn:host:${code}`), null) ??
    undefined,
  setHostKey: (code: string, key: string) => {
    session.set(`scxn:host:${code}`, key);
    safe(() => window.localStorage.setItem(`scxn:host:${code}`, key), undefined);
  },
};
