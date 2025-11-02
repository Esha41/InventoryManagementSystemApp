export interface APIOperationResponse<T> {
  succeeded: boolean;
  data: T;
  message: string;
  messageType: ResponseType;
  errorCode: string | null;
  errors: string[] | null;
}

export enum ResponseType {
  Success = 0,
  NotFound = 1,
  BadRequest = 2,
  Unauthorized = 3,
  Forbidden = 4,
  InternalServerError = 5,
  ValidationError = 6
}


