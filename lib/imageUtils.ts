import domtoimage from 'dom-to-image-more';

export interface ImageCaptureOptions {
  scale?: number;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
  backgroundColor?: string;
}

export class ImageCapture {
  private static getOptimalScale(): number {
    const pixelRatio = window.devicePixelRatio || 1;
    return Math.max(4, pixelRatio * 2);
  }

  public static async captureWithDomToImage(
    element: HTMLElement,
    options: ImageCaptureOptions = {}
  ): Promise<Blob> {
    const pixelRatio = window.devicePixelRatio || 1;
    const scale = options.scale || this.getOptimalScale();

    const dataUrl = await domtoimage.toPng(element, {
      quality: options.quality || 1.0,
      pixelRatio: scale,
      width: element.offsetWidth * scale,
      height: element.offsetHeight * scale,
      style: {
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: element.offsetWidth + 'px',
        height: element.offsetHeight + 'px',
      },
    });

    const response = await fetch(dataUrl);
    return response.blob();
  }

  public static async copyToClipboard(
    element: HTMLElement,
    options: ImageCaptureOptions = {}
  ): Promise<void> {
    try {
      const blob = await this.captureWithDomToImage(element, options);

      await navigator.clipboard.write([
        new ClipboardItem({
          [`image/${options.format || 'png'}`]: blob,
        }),
      ]);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      throw err;
    }
  }

  public static async downloadImage(
    element: HTMLElement,
    filename: string,
    options: ImageCaptureOptions = {}
  ): Promise<void> {
    try {
      const blob = await this.captureWithDomToImage(element, options);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download image:', err);
      throw err;
    }
  }
}
