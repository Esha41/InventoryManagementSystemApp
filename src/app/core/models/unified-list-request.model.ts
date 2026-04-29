import type { RequestManagementBaseRequestDto } from './request-management-base.model';
import type { OrderSpecificDto } from './order.model';
import type { ReturnSpecificDto } from './return.model';

/**
 * Polymorphic item returned by Request Management unified list/detail (`OrderDto` | `ReturnDto` | `DiscardDto`).
 * Modeled as base + optional type-specific fields present on the concrete CLR type.
 *
 * Backend references:
 * - `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/BaseRequestDto.cs`
 * - `ettadbackend/Ettad.RequestManagement.Service/Orders/Dto/OrderDto.cs`
 * - `ettadbackend/Ettad.RequestManagement.Service/Returns/Dtos/ReturnDto.cs`
 * - `ettadbackend/Ettad.RequestManagement.Service/Discards/Dtos/DiscardDto.cs`
 */
export type UnifiedListRequestDto = RequestManagementBaseRequestDto &
  Partial<OrderSpecificDto> &
  Partial<ReturnSpecificDto>;
