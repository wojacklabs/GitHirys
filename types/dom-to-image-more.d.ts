declare module 'dom-to-image-more' {
  export interface Options {
    filter?: (node: Node) => boolean;
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: any;
    quality?: number;
    cacheBust?: boolean;
    imagePlaceholder?: string;
    pixelRatio?: number;
    skipFonts?: boolean;
  }

  export function toPng(node: Node, options?: Options): Promise<string>;
  export function toJpeg(node: Node, options?: Options): Promise<string>;
  export function toSvg(node: Node, options?: Options): Promise<string>;
  export function toPixelData(
    node: Node,
    options?: Options
  ): Promise<Uint8ClampedArray>;
  export function toCanvas(
    node: Node,
    options?: Options
  ): Promise<HTMLCanvasElement>;
  export function toBlob(node: Node, options?: Options): Promise<Blob>;

  const domtoimage: {
    toPng: typeof toPng;
    toJpeg: typeof toJpeg;
    toSvg: typeof toSvg;
    toPixelData: typeof toPixelData;
    toCanvas: typeof toCanvas;
    toBlob: typeof toBlob;
  };

  export default domtoimage;
}
