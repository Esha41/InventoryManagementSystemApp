/**
 * Cross-cutting services (HTTP, auth, storage, i18n, theme, logs, Excel, etc.).
 * Domain services live under each feature's `services/` folder.
 */

export * from './api.service';
export * from './config.service';
export * from './storage.service';
export * from './translation.service';
export * from './backend-auth.service';
export * from './backend-user.service';
export * from './lookup.service';
export * from './toast.service';
export * from './file-upload.service';
export * from './theme.service';
export * from './logging.service';
export * from './user-context.service';
export * from './monitoring.service';
export * from './role.service';
export * from './idle.service';
export * from './excel.service';
export * from './template-generation.service';

// Supply API DTOs (canonical definitions in core/models/supply-dto.model)
export type {
    SupplyLotSuggestionDto,
    OrderItemSupplySuggestionDto,
    OrderSupplySuggestionDto,
    CreateSupplyDetailDto,
    CreateSupplyDto,
    UpdateSupplyDto,
    SubmitSupplyDto,
    UpdateSupplyDetailDto,
    SupplyDetailDto,
    SupplyDto
} from '@models/supply-dto.model';
