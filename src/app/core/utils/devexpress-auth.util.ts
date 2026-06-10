import { ajaxSetup, fetchSetup, _isFetchConfigured } from '@devexpress/analytics-core/analytics-utils';

/**
 * DevExpress reporting uses its own fetch/ajax layer (not Angular HttpClient),
 * so the auth interceptor never runs. Attach the JWT before designer/viewer init.
 */
export function configureDevexpressAuthHeaders(authToken: string | null | undefined): void {
  if (!authToken) {
    return;
  }

  const headers = {
    Authorization: `Bearer ${authToken}`
  };

  // Request manager defaults to fetch when neither setup has keys yet.
  const useFetch = (() => {
    try {
      return _isFetchConfigured();
    } catch {
      return true;
    }
  })();

  if (useFetch) {
    fetchSetup.fetchSettings.headers = {
      ...(fetchSetup.fetchSettings.headers ?? {}),
      ...headers
    };
  } else {
    ajaxSetup.ajaxSettings.headers = {
      ...(ajaxSetup.ajaxSettings.headers ?? {}),
      ...headers
    };
  }
}
