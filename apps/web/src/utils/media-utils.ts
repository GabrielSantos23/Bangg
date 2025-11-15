/**
 * Utility functions for handling media files in Plate editor
 * Converts media files to base64 format for database storage
 */

/**
 * Converts a File or Blob to base64 data URL
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Converts an image URL to base64 (for external images)
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await fileToBase64(blob);
  } catch (error) {
    console.error('Failed to convert image URL to base64:', error);
    throw error;
  }
}

/**
 * Processes Plate editor value to convert media URLs to base64
 * Only converts local files (File objects) or URLs that are already being processed
 * External URLs are kept as-is unless explicitly requested
 */
export async function processMediaToBase64(
  value: any[],
  options?: { convertExternalUrls?: boolean }
): Promise<any[]> {
  const { convertExternalUrls = false } = options || {};

  const processNode = async (node: any): Promise<any> => {
    if (!node || typeof node !== 'object') {
      return node;
    }

    // Check if node is a media element (image, video, audio, file)
    const mediaTypes = ['img', 'image', 'video', 'audio', 'file'];
    const isMediaNode = mediaTypes.includes(node.type);

    if (isMediaNode && node.url) {
      // Skip if already base64
      if (node.url.startsWith('data:')) {
        // Recursively process children
        if (Array.isArray(node.children)) {
          const processedChildren = await Promise.all(
            node.children.map(processNode)
          );
          return {
            ...node,
            children: processedChildren,
          };
        }
        return node;
      }

      // Only convert if it's a local file or convertExternalUrls is true
      const shouldConvert =
        node.url instanceof File ||
        (convertExternalUrls && typeof node.url === 'string');

      if (shouldConvert) {
        try {
          let base64: string;
          if (node.url instanceof File) {
            base64 = await fileToBase64(node.url);
          } else {
            base64 = await imageUrlToBase64(node.url);
          }
          return {
            ...node,
            url: base64,
            children: Array.isArray(node.children)
              ? await Promise.all(node.children.map(processNode))
              : node.children,
          };
        } catch (error) {
          console.error(`Failed to convert ${node.type} to base64:`, error);
          // Keep original URL if conversion fails
        }
      }
    }

    // Recursively process children
    if (Array.isArray(node.children)) {
      const processedChildren = await Promise.all(
        node.children.map(processNode)
      );
      return {
        ...node,
        children: processedChildren,
      };
    }

    return node;
  };

  return Promise.all(value.map(processNode));
}

/**
 * Checks if a URL is already in base64 format
 */
export function isBase64(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Gets the MIME type from a base64 data URL
 */
export function getMimeTypeFromBase64(base64: string): string | null {
  const match = base64.match(/^data:([^;]+);base64,/);
  return match ? match[1] : null;
}

