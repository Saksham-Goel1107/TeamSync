export type ToastVariant = "success" | "destructive" | "default";

export interface ToastOptions {
  title: string;
  description: string;
  variant?: ToastVariant;
}
