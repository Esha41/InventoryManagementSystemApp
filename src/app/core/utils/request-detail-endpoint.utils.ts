import { API_ENDPOINTS } from '@constants/app.constants';
import { RequestTypeEnum } from '@utils/request-mapper.utils';

export interface ResolveRequestDetailEndpointOptions {
  defaultToOrderWhenMissing?: boolean;
}

export function resolveRequestDetailEndpoint(
  requestType: number | null | undefined,
  requestId: number,
  options?: ResolveRequestDetailEndpointOptions
): string | null {
  if (requestType == null) {
    return options?.defaultToOrderWhenMissing ? API_ENDPOINTS.ORDERS.BY_ID(requestId) : null;
  }

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
