import { API_ENDPOINTS } from '@constants/app.constants';
import { RequestTypeEnum } from '@utils/request-mapper.utils';

export interface ResolveRequestDetailEndpointOptions {
  defaultToOrderWhenMissing?: boolean;
}

export function resolveRequestDetailEndpoint(
  requestType: number | string | null | undefined,
  requestId: number,
  options?: ResolveRequestDetailEndpointOptions
): string | null {
  if (typeof requestType === 'number') {
    switch (requestType) {
      case RequestTypeEnum.Order:
        return API_ENDPOINTS.ORDERS.BY_ID(requestId);
      case RequestTypeEnum.Return:
        return API_ENDPOINTS.RETURNS.BY_ID(requestId);
      case RequestTypeEnum.Discard:
        return API_ENDPOINTS.DISCARDS.BY_ID(requestId);
      default:
        return options?.defaultToOrderWhenMissing
          ? API_ENDPOINTS.ORDERS.BY_ID(requestId)
          : null;
    }
  }

  if (typeof requestType === 'string') {
    switch (requestType.toLowerCase()) {
      case 'order':
        return API_ENDPOINTS.ORDERS.BY_ID(requestId);
      case 'return':
        return API_ENDPOINTS.RETURNS.BY_ID(requestId);
      case 'discard':
        return API_ENDPOINTS.DISCARDS.BY_ID(requestId);
      default:
        return options?.defaultToOrderWhenMissing
          ? API_ENDPOINTS.ORDERS.BY_ID(requestId)
          : null;
    }
  }

  return options?.defaultToOrderWhenMissing ? API_ENDPOINTS.ORDERS.BY_ID(requestId) : null;
}
