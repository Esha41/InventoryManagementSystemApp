import { Observable } from 'rxjs';
import { APIOperationResponse } from '../models/api-response.model';
import { ImportResult } from '../models';

export interface IImportableService {
    importData(file: File, language?: string, contextId?: unknown): Observable<APIOperationResponse<ImportResult>>;
    importPreview(file: File, language?: string, contextId?: unknown): Observable<APIOperationResponse<ImportResult>>;
    generateImportTemplate(language?: string, contextId?: unknown): Observable<Blob>;
}
