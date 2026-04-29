/**
 * Login Error Mapper
 *
 * Pure functions that translate raw API errors into a structured,
 * UI-ready result. The login component used to do all of this inline
 * (3 separate code-extraction blocks + 290 lines of branching) — it
 * now just calls `analyzeLoginError(err, ctx)` and reacts to the result.
 *
 * Decoupling: the mapper does not depend on Angular or `TranslateService`
 * directly. The caller passes a `translate(key, params?)` function. This
 * keeps the util pure and trivially testable with a stub translator.
 */

export type LoginErrorTranslator = (key: string, params?: Record<string, unknown>) => string;

export interface LoginErrorContext {
  isLdapMode: boolean;
  username?: string;
  translate: LoginErrorTranslator;
}

export interface AnalyzedLoginError {
  /** User-facing message, already translated. */
  message: string;
  /** True when the backend signals an existing live session (code 22 / 'ALREADY_LOGGED_IN'). */
  isAlreadyLoggedIn: boolean;
  /** True when the backend asks for a captcha (code 18 / 'CAPTCHA_REQUIRED'). */
  requiresCaptcha: boolean;
}

/** Numeric backend code → string code (mirrors backend `CommonErrorCodes`). */
const NUMERIC_TO_STRING_CODE: Readonly<Record<number, string>> = {
  8: 'INVALID_EMAIL_OR_PASSWORD',
  14: 'INVALID_LDAP_SETTINGS',
  15: 'ACCOUNT_DELETED',
  16: 'ACCOUNT_LOCKED',
  17: 'ACCOUNT_DISABLED',
  18: 'CAPTCHA_REQUIRED',
  19: 'CAPTCHA_INVALID',
  20: 'INVALID_DOMAIN',
  21: 'INVALID_USERNAME_FORMAT',
  22: 'ALREADY_LOGGED_IN'
};

/**
 * Single entry point. Extract code, status, raw message, then map to
 * a translated user-facing message + boolean flags the caller needs.
 */
export function analyzeLoginError(error: unknown, ctx: LoginErrorContext): AnalyzedLoginError {
  const errorCode = extractErrorCode(error);
  const numericCode = extractNumericCode(error);
  const statusCode = extractStatusCode(error);
  const rawMessage = extractRawMessage(error);

  const isAlreadyLoggedIn = errorCode === 'ALREADY_LOGGED_IN' || numericCode === 22;
  const requiresCaptcha =
    errorCode === 'CAPTCHA_REQUIRED' ||
    errorCode === '0018' ||
    numericCode === 18;

  const message = mapToMessage({ errorCode, numericCode, statusCode, rawMessage }, ctx);

  return { message, isAlreadyLoggedIn, requiresCaptcha };
}

// ────────────────────────────────────────────────────────────────────────
// Extraction helpers
// ────────────────────────────────────────────────────────────────────────

export function extractErrorCode(error: unknown): string {
  const err = error as Record<string, unknown> | null | undefined;
  const errError = err?.['error'] as Record<string, unknown> | undefined;
  const errCode = errError?.['code'] as Record<string, unknown> | undefined;
  const errData = errError?.['data'] as Record<string, unknown> | undefined;

  let code =
    (errCode?.['value'] as string) ||
    (errCode?.['Value'] as string) ||
    (errError?.['value'] as string) ||
    (errError?.['errorCode'] as string) ||
    (err?.['errorCode'] as string) ||
    (errData?.['errorCode'] as string) ||
    '';

  if (!code) {
    const numeric = extractNumericCode(error);
    if (numeric !== null) {
      code = NUMERIC_TO_STRING_CODE[numeric] ?? '';
    }
  }

  return code;
}

export function extractNumericCode(error: unknown): number | null {
  const err = error as Record<string, unknown> | null | undefined;
  const errError = err?.['error'] as Record<string, unknown> | undefined;
  const errCode = errError?.['code'];

  if (typeof errCode === 'number') return errCode;
  if (errCode && typeof errCode === 'object') {
    const codeObj = errCode as Record<string, unknown>;
    const n = (codeObj['code'] as number) ?? (codeObj['Code'] as number);
    if (typeof n === 'number') return n;
  }
  if (typeof err?.['errorCode'] === 'number') return err['errorCode'] as number;

  return null;
}

function extractStatusCode(error: unknown): number {
  const err = error as Record<string, unknown> | null | undefined;
  const errError = err?.['error'] as Record<string, unknown> | undefined;
  return (err?.['status'] as number) || (errError?.['status'] as number) || 0;
}

function extractRawMessage(error: unknown): string {
  // Inlined from `ErrorHandler.extractErrorMessage` semantics — we tolerate
  // multiple shapes the backend may produce.
  const err = error as Record<string, unknown> | null | undefined;
  if (!err) return '';

  const errError = err['error'] as Record<string, unknown> | undefined;
  const candidates: unknown[] = [
    errError?.['message'],
    errError?.['error'],
    err['message'],
    typeof err === 'string' ? err : null
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c;
    }
  }
  return '';
}

// ────────────────────────────────────────────────────────────────────────
// Message mapping (the meat — translated user-facing string)
// ────────────────────────────────────────────────────────────────────────

interface MapInput {
  errorCode: string;
  numericCode: number | null;
  statusCode: number;
  rawMessage: string;
}

function mapToMessage(input: MapInput, ctx: LoginErrorContext): string {
  const { errorCode, statusCode, rawMessage } = input;
  const { translate, isLdapMode } = ctx;
  const lowerMessage = String(rawMessage).toLowerCase();

  // ─── Pass-through user-friendly backend messages ─────────────────────
  if (rawMessage && rawMessage.trim()) {
    if (lowerMessage.includes('domain') || lowerMessage.includes('invalid domain')) {
      return rawMessage;
    }
    if (isLikelyUserFriendly(rawMessage)) {
      const translated = translateBackendMessage(rawMessage, lowerMessage, translate);
      return translated ?? rawMessage;
    }
  }

  // ─── Specific error code branches (priority order) ───────────────────
  if (errorCode === 'ACCOUNT_LOCKED' || errorCode === '0016') {
    if (rawMessage && rawMessage.trim() && !rawMessage.includes('Error') && !rawMessage.includes('Exception')) {
      const translated = translateBackendMessage(rawMessage, lowerMessage, translate);
      return translated ?? rawMessage;
    }
    return translate('auth.login.errors.accountLocked');
  }

  if (errorCode === 'ACCOUNT_DISABLED' || errorCode === '0017') {
    if (rawMessage && rawMessage.trim() && !rawMessage.includes('Error') && !rawMessage.includes('Exception')) {
      return rawMessage;
    }
    return translate('auth.login.errors.accountDisabled');
  }

  if (errorCode === 'ACCOUNT_DELETED' || errorCode === '0015') {
    return translate('auth.login.errors.accountDeleted');
  }

  if (errorCode === 'INVALID_DOMAIN' || errorCode === '0020') {
    if (rawMessage && rawMessage.includes('server.invalidDomain')) {
      return translate('auth.login.errors.invalidDomain');
    }
    return translate('auth.login.errors.invalidDomain') ||
      'Invalid domain. Please check your username format.';
  }

  if (errorCode === 'INVALID_USERNAME_FORMAT' || errorCode === '0021') {
    if (rawMessage && rawMessage.trim()) return rawMessage;
    return translate('auth.login.errors.invalidUsernameFormat') ||
      'Invalid username format. Please use username or username@domain.com';
  }

  if (errorCode === 'CAPTCHA_REQUIRED' || errorCode === '0018') {
    if (rawMessage && rawMessage.trim()) return rawMessage;
    return translate('auth.login.errors.captchaRequired') ||
      'CAPTCHA verification is required. Please complete the CAPTCHA and try again.';
  }

  if (errorCode === 'CAPTCHA_INVALID' || errorCode === '0019') {
    if (rawMessage && rawMessage.trim()) return rawMessage;
    return translate('auth.login.errors.captchaInvalid') ||
      'CAPTCHA verification failed. Please try again.';
  }

  if (errorCode === 'INVALID_LDAP_SETTINGS' || errorCode === '0014') {
    return translate('auth.login.errors.invalidLdapSettings');
  }

  if (
    errorCode === 'INVALID_EMAIL_OR_PASSWORD' ||
    errorCode === '0008' ||
    errorCode === 'INVALID_CREDENTIALS' ||
    errorCode === 'AUTH_FAILED'
  ) {
    if (
      rawMessage &&
      rawMessage.trim() &&
      !rawMessage.includes('Exception') &&
      !rawMessage.includes('APIOperationResponse') &&
      !rawMessage.includes('HttpErrorResponse') &&
      !rawMessage.startsWith('Http failure') &&
      !rawMessage.includes('at ') &&
      !rawMessage.includes('Stack') &&
      !rawMessage.includes('server.invalidLogin') &&
      rawMessage.length < 300
    ) {
      return rawMessage;
    }
    if (isLdapMode) {
      return (
        translate('auth.login.errors.invalidLdapCredentials') ||
        translate('auth.login.errors.invalidCredentials')
      );
    }
    return translate('auth.login.errors.invalidCredentials');
  }

  // ─── Pattern-matched messages (no error code) ────────────────────────
  if (
    errorCode === 'SESSION_CONFLICT' ||
    errorCode === 'MULTIPLE_SESSIONS' ||
    lowerMessage.includes('session conflict') ||
    lowerMessage.includes('multiple sessions')
  ) {
    return translate('auth.login.errors.singleSession');
  }

  if (
    lowerMessage.includes('server.invalidlogin') ||
    lowerMessage.includes('invalidlogin') ||
    lowerMessage.includes('invalid login') ||
    lowerMessage.includes('login failed')
  ) {
    return translate('auth.login.errors.invalidLogin');
  }

  if (
    lowerMessage.includes('incorrect password') ||
    lowerMessage.includes('wrong password') ||
    lowerMessage.includes('invalid password') ||
    lowerMessage.includes('password is incorrect') ||
    lowerMessage.includes('password incorrect')
  ) {
    return translate('auth.login.errors.invalidCredentials');
  }

  if (
    (lowerMessage.includes('invalid') &&
      (lowerMessage.includes('login') ||
        lowerMessage.includes('password') ||
        lowerMessage.includes('credential') ||
        lowerMessage.includes('username'))) ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('bad credentials') ||
    lowerMessage.includes('authentication failed') ||
    lowerMessage.includes('access denied')
  ) {
    return translate('auth.login.errors.invalidCredentials');
  }

  if (
    lowerMessage.includes('ldap') &&
    (lowerMessage.includes('invalid') ||
      lowerMessage.includes('not available') ||
      lowerMessage.includes('inactive') ||
      lowerMessage.includes('not configured') ||
      lowerMessage.includes('connection failed'))
  ) {
    return translate('auth.login.errors.invalidLdapSettings');
  }

  // ─── HTTP status code fallbacks ─────────────────────────────────────
  const isLikelyNetworkError =
    statusCode === 0 ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('networkerror') ||
    lowerMessage.includes('connection refused') ||
    lowerMessage.includes('cannot connect') ||
    lowerMessage.includes('net::err_') ||
    lowerMessage.includes('ERR_INTERNET_DISCONNECTED') ||
    lowerMessage.includes('ERR_CONNECTION_REFUSED');
  if (isLikelyNetworkError) {
    return translate('auth.login.errors.networkError');
  }

  if (
    statusCode >= 500 ||
    statusCode === 503 ||
    statusCode === 502 ||
    statusCode === 504 ||
    lowerMessage.includes('internal server error') ||
    lowerMessage.includes('server error') ||
    lowerMessage.includes('service unavailable') ||
    lowerMessage.includes('bad gateway') ||
    lowerMessage.includes('gateway timeout')
  ) {
    return translate('auth.login.errors.serverError');
  }

  if (statusCode === 403) {
    if (lowerMessage.includes('disabled') || lowerMessage.includes('inactive')) {
      return translate('auth.login.errors.accountDisabled');
    }
    return translate('auth.login.errors.accessDenied');
  }

  if (statusCode === 401) {
    return translate('auth.login.errors.invalidCredentials');
  }

  if (statusCode === 400) {
    if (
      lowerMessage.includes('username') ||
      lowerMessage.includes('password') ||
      lowerMessage.includes('required')
    ) {
      return translate('auth.login.errors.invalidCredentials');
    }
    return translate('auth.login.errors.loginFailed');
  }

  // ─── Final fallback: pass through if message looks safe ─────────────
  if (rawMessage && rawMessage.trim() && !isTechnicalMessage(rawMessage) && rawMessage.length < 200) {
    return rawMessage;
  }

  return translate('auth.login.errors.unknownError');
}

// ────────────────────────────────────────────────────────────────────────
// Internal predicates
// ────────────────────────────────────────────────────────────────────────

function isLikelyUserFriendly(message: string): boolean {
  return (
    !message.includes('server.') &&
    !message.includes('Error') &&
    !message.includes('Exception') &&
    !message.includes('APIOperationResponse') &&
    !message.includes('HttpErrorResponse') &&
    !message.startsWith('Http failure') &&
    !message.includes('TypeError') &&
    !message.includes('ReferenceError') &&
    !message.includes('at ') &&
    !message.includes('Stack') &&
    message.length < 200
  );
}

function isTechnicalMessage(message: string): boolean {
  return (
    message.includes('server.') ||
    message.includes('Error') ||
    message.includes('Exception') ||
    message.includes('APIOperationResponse') ||
    message.includes('HttpErrorResponse') ||
    message.startsWith('Http failure') ||
    message.includes('TypeError') ||
    message.includes('ReferenceError') ||
    message.includes('at ') ||
    message.includes('Stack')
  );
}

/** Translate common backend message patterns; returns null when no pattern matches. */
function translateBackendMessage(
  message: string,
  lowerMessage: string,
  translate: LoginErrorTranslator
): string | null {
  if (
    lowerMessage.includes('temporarily locked') ||
    lowerMessage.includes('too many failed') ||
    lowerMessage.includes('locked due to')
  ) {
    const minutesMatch = message.match(/(\d+)\s*(?:minute|min|minutes?)/i);
    if (minutesMatch && minutesMatch[1]) {
      return translate('auth.login.errors.accountTemporarilyLocked', { minutes: minutesMatch[1] });
    }
    return translate('auth.login.errors.accountTemporarilyLockedGeneric');
  }
  return null;
}
