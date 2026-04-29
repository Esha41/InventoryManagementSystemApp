import { CaptchaResponse } from '@models/auth.model';
import { APIOperationResponse } from '@models/api-response.model';

export function parseGenerateCaptchaApiPayload(response: unknown): CaptchaResponse {
  if (response && typeof response === 'object' && 'succeeded' in response) {
    const apiResponse = response as APIOperationResponse<CaptchaResponse>;
    if (!apiResponse.succeeded) {
      throw new Error(apiResponse.message || 'Failed to generate captcha');
    }
    if (!apiResponse.data || !(apiResponse.data as { captchaId?: string }).captchaId) {
      throw new Error('Invalid captcha response: missing captchaId');
    }
    return apiResponse.data as CaptchaResponse;
  }

  if (response && typeof response === 'object' && 'captchaId' in response) {
    const directResponse = response as CaptchaResponse;
    if (!directResponse.captchaId) {
      throw new Error('Invalid captcha response: missing captchaId');
    }
    return directResponse;
  }

  throw new Error('Invalid captcha response format');
}
