const SESSION_KEY = 'ettad.termsAcceptedVersionId';

export function getSessionAcceptedTermsVersionId(): number | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw == null || raw === '') {
      return null;
    }
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function setSessionAcceptedTermsVersionId(id: number): void {
  try {
    sessionStorage.setItem(SESSION_KEY, String(id));
  } catch {
    // sessionStorage unavailable (private mode, etc.)
  }
}

export function clearSessionTermsAcceptance(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function hasSessionAcceptedTermsVersion(id: number): boolean {
  const accepted = getSessionAcceptedTermsVersionId();
  return accepted != null && accepted === id;
}
