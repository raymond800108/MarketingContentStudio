/**
 * Convert any image source to PNG using canvas.
 * Handles HEIC, WebP, and other formats that Kie.ai doesn't support.
 */
export async function convertToPng(src: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to convert image"));
          resolve(new File([blob], "image.png", { type: "image/png" }));
        },
        "image/png"
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Upload an image to fal.ai storage, converting to PNG if needed.
 * Returns the hosted URL or null on failure.
 */
export async function uploadForReference(
  url: string,
  file: File | null
): Promise<string | null> {
  const isRemote = url.startsWith("http://") || url.startsWith("https://");
  let fileToUpload: File | null = null;

  if (isRemote) {
    // Check if URL already points to a supported image type
    const lowerUrl = url.toLowerCase().split("?")[0];
    if (
      lowerUrl.endsWith(".png") ||
      lowerUrl.endsWith(".jpg") ||
      lowerUrl.endsWith(".jpeg")
    ) {
      return url;
    }
    // Try to convert unsupported formats to PNG
    try {
      fileToUpload = await convertToPng(url);
    } catch {
      return url; // If conversion fails (CORS etc.), pass URL through
    }
  } else {
    fileToUpload = file ?? null;

    if (!fileToUpload || fileToUpload.size === 0) {
      if (url.startsWith("blob:")) {
        try {
          fileToUpload = await convertToPng(url);
        } catch {
          return null;
        }
      } else {
        return null;
      }
    } else {
      // Convert non-standard formats to PNG
      const type = fileToUpload.type;
      if (type !== "image/png" && type !== "image/jpeg") {
        try {
          const blobUrl = URL.createObjectURL(fileToUpload);
          fileToUpload = await convertToPng(blobUrl);
          URL.revokeObjectURL(blobUrl);
        } catch {
          // Keep original file if conversion fails
        }
      }
    }
  }

  if (!fileToUpload) return null;

  const formData = new FormData();
  formData.append("file", fileToUpload);
  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}
