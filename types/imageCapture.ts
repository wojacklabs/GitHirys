export interface ImageCaptureOptions {
  scale?: number;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
  backgroundColor?: string;
}

export interface ImageCaptureResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ImageCaptureConfig {
  options: ImageCaptureOptions;
  enableOptimization?: boolean;
}
