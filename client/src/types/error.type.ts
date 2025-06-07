export interface APIError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message: string;
}
