/** REST response envelope shared by both repository endpoints. */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}
