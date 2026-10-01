import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

export { createSearchEndpoint, createSearchText } from "./endpoint.js";

export interface SearchImage {
  src: string;
  srcset?: string;
  sizes?: string;
  width?: number;
  height?: number;
}

export interface SearchImageOptions {
  width?: number;
  widths?: number[];
  sizes?: string;
  format?: "webp" | "avif" | "png" | "jpeg";
  quality?: number;
}

export const defaultImageOptions = {
  width: 670,
  widths: [320, 480, 670],
  sizes: "(min-width: 1400px) 670px, (min-width: 768px) calc((90vw - 24px) / 2), 90vw",
  format: "webp" as const,
};

// Build-only entry point. The core and template modules never import this file.
export async function getSearchImage(
  src: ImageMetadata,
  options: SearchImageOptions = {},
): Promise<SearchImage> {
  const resolved = { ...defaultImageOptions, ...options };
  const image = await getImage({ src, ...resolved });
  return {
    src: image.src,
    srcset: image.srcSet.attribute || undefined,
    sizes: resolved.sizes,
    width: Number(image.attributes.width),
    height: Number(image.attributes.height),
  };
}
