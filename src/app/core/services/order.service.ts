import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { APIOperationResponse } from '@models/api-response.model';

export interface CreateOrderRequest {
  orderNo: string;
  requestNo: string;
  reason: string;
  priority: number;
  notes?: string;
  departmentId: number;
  requestTypeId?: number | null;
  requesterId?: number | null;
  recieverId?: number | null;
  depotId?: number | null;
  requestPurposeId: number;
  isFromAllowance: boolean;
  usageDate: string;
  usageTime: string;
  usagePurpose: string;
  annualDiscard?: number | null;
  usageLocation: string;
  numberOfOfficer?: number | null;
  numberOfOtherRank?: number | null;
  requestItems: Array<{
    itemId: number;
    quantity: number;
    notes?: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) {}

  private get baseUrl(): string {
    return `${this.config.apiUrl}/Order`;
  }

  createOrder(payload: CreateOrderRequest): Observable<APIOperationResponse<number>> {
    return this.http.post<APIOperationResponse<number>>(this.baseUrl, payload);
  }
}

