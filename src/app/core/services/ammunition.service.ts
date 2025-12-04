import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, forkJoin, catchError, of, switchMap } from 'rxjs';
import { ConfigService } from './config.service';
import { APIOperationResponse } from '@models/api-response.model';
import { AmmunitionReadDto, AmmunitionCreateDto, AmmunitionUpdateDto } from '@models/ammunition.model';

interface ApiListResponse<T> {
  succeeded?: boolean;
  data?: T[];
  result?: T[];
}

@Injectable({ providedIn: 'root' })
export class AmmunitionService {
  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) {}

  private get baseUrl(): string {
    return `${this.config.apiUrl}/Ammunition`;
  }

  // Fetch list of ammunitions (assets) from backend Ammunition API
  getAll<T = AmmunitionReadDto>(query?: { search?: string }): Observable<T[]> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);

    return this.http.get<APIOperationResponse<T[]> | ApiListResponse<T> | T[]>(this.baseUrl, { params }).pipe(
      map((res: APIOperationResponse<T[]> | ApiListResponse<T> | T[] | unknown) => {
        // Handle APIOperationResponse format
        if (res && typeof res === 'object' && 'succeeded' in res && 'data' in res) {
          const apiOpResponse = res as APIOperationResponse<T[]>;
          if (apiOpResponse.succeeded && apiOpResponse.data && Array.isArray(apiOpResponse.data)) {
            return apiOpResponse.data as T[];
          }
        }
        // Handle array directly
        if (Array.isArray(res)) return res as T[];
        // Handle ApiListResponse format
        const apiResponse = res as ApiListResponse<T>;
        if (apiResponse?.data && Array.isArray(apiResponse.data)) return apiResponse.data as T[];
        if (apiResponse?.result && Array.isArray(apiResponse.result)) return apiResponse.result as T[];
        return [] as T[];
      })
    );
  }

  // Get ammunition by ID
  getById<T = AmmunitionReadDto>(id: number): Observable<T | null> {
    return this.http.get<ApiListResponse<T> | T>(`${this.baseUrl}/${id}`).pipe(
      map((res: ApiListResponse<T> | T | unknown) => {
        const apiResponse = res as ApiListResponse<T>;
        if (apiResponse?.data) return apiResponse.data as T;
        if (apiResponse?.result) return apiResponse.result as T;
        return res as T;
      })
    );
  }

  // Update ammunition
  // Note: Backend uses CreateUpdateAmmunitionDto (same as create, without id/lot)
  update<T = AmmunitionReadDto>(id: number, data: AmmunitionCreateDto): Observable<APIOperationResponse<T>> {
    return this.http.put<APIOperationResponse<T>>(`${this.baseUrl}/${id}`, data);
  }

  // Delete ammunition
  delete(id: number): Observable<APIOperationResponse<boolean>> {
    return this.http.delete<APIOperationResponse<boolean>>(`${this.baseUrl}/${id}`);
  }

  // Create ammunition
  create<T = AmmunitionReadDto>(data: AmmunitionCreateDto): Observable<APIOperationResponse<T>> {
    return this.http.post<APIOperationResponse<T>>(this.baseUrl, data);
  }

  // Get image URL for an ammunition item
  getImageUrl(ammunitionId: number): Observable<string | null> {
    const fileUploadUrl = `${this.config.apiUrl}/FileUpload?entityId=1&primaryId=${ammunitionId}`;
    return this.http.get<APIOperationResponse<any[]>>(fileUploadUrl).pipe(
      map((response) => {
        if (response?.succeeded && response?.data && response.data.length > 0) {
          // Get the main file or first file
          const mainFile = response.data.find((f: any) => f.isMain) || response.data[0];
          if (mainFile?.id) {
            // Use the file serving endpoint instead of direct file path
            return `${this.config.apiUrl}/FileUpload/serve/${mainFile.id}`;
          }
        }
        return null;
      }),
      catchError(() => {
        // Silently fail - image is optional
        return of(null);
      })
    );
  }

  // Get image as blob URL (for authenticated requests)
  getImageBlobUrl(ammunitionId: number): Observable<string | null> {
    return this.getImageUrl(ammunitionId).pipe(
      map((imageUrl) => {
        if (!imageUrl) return null;
        // Return the URL - the interceptor will add auth headers
        // But we need to fetch as blob to create a blob URL
        return imageUrl;
      }),
      catchError(() => of(null))
    );
  }

  // Load images for multiple ammunition items
  // Fetches images as blobs with authentication and creates blob URLs
  loadAssetImages(ammunitionIds: number[]): Observable<Map<number, string | null>> {
    if (ammunitionIds.length === 0) {
      return of(new Map());
    }

    console.log('loadAssetImages called with IDs:', ammunitionIds);

    const imageMap$ = ammunitionIds.map(id => 
      this.getImageUrl(id).pipe(
        switchMap(url => {
          console.log(`Ammunition ${id}: Got image URL:`, url);
          if (!url) {
            console.log(`Ammunition ${id}: No image URL found`);
            return of({ id, url: null });
          }
          
          // Fetch image as blob with authentication headers
          // The HTTP interceptor will add the auth token automatically
          return this.http.get(url, { responseType: 'blob' }).pipe(
            map(blob => {
              // Verify blob is actually an image
              if (blob.type && blob.type.startsWith('image/')) {
                // Create a blob URL that the browser can use
                const blobUrl = URL.createObjectURL(blob);
                console.log(`Ammunition ${id}: Created blob URL for image (type: ${blob.type}, size: ${blob.size} bytes)`);
                return { id, url: blobUrl };
              } else {
                console.warn(`Ammunition ${id}: Blob is not an image (type: ${blob.type}), might be an error response`);
                // Try to read as text to see if it's an error message
                const reader = new FileReader();
                reader.onload = () => {
                  console.error(`Ammunition ${id}: Blob content:`, reader.result);
                };
                reader.readAsText(blob);
                return { id, url: null };
              }
            }),
            catchError((error) => {
              console.error(`Failed to fetch image blob for ammunition ${id} from URL: ${url}`, error);
              console.error(`Error status: ${error.status}, message: ${error.message}`);
              // Return null if fetch fails
              return of({ id, url: null });
            })
          );
        }),
        catchError((error) => {
          console.error(`Failed to get image URL for ammunition ${id}:`, error);
          return of({ id, url: null });
        })
      )
    );

    return forkJoin(imageMap$).pipe(
      map((results) => {
        console.log('Image loading results:', results);
        const map = new Map<number, string | null>();
        results.forEach(({ id, url }) => {
          map.set(id, url);
          console.log(`Setting image for asset ${id}:`, url ? `Blob URL created` : 'null');
        });
        return map;
      }),
      catchError((err) => {
        console.error('Failed to load asset images:', err);
        // Return empty map on error
        return of(new Map());
      })
    );
  }

  // This method is no longer needed as we use the file serving endpoint
  // Keeping it for backward compatibility but it should not be used
  private convertFileUrlToAccessible(fileUrl: string): string {
    // If it's already a full URL, return it
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    
    // For UNC paths, we should use the file serving endpoint instead
    // This is a fallback that tries to extract a relative path
    let cleaned = fileUrl.replace(/^\\\\/, '');
    cleaned = cleaned.replace(/\\/g, '/');
    
    const sharePrefix = 'SDShare/';
    const indexOfShare = cleaned.indexOf(sharePrefix);
    
    if (indexOfShare !== -1) {
      const relativePath = cleaned.substring(indexOfShare + sharePrefix.length);
      // Use the file serving endpoint with path parameter
      return `${this.config.apiUrl}/FileUpload/serve?path=${encodeURIComponent(relativePath)}`;
    }
    
    // Fallback: try to use the path directly
    return `${this.config.apiUrl}/FileUpload/serve?path=${encodeURIComponent(cleaned)}`;
  }
  
}



