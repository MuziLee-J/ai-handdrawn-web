export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('无法导出裁剪后的图片'));
      },
      type,
      quality,
    );
  });
}

/**
 * 在浏览器本地完成裁剪，不修改原始文件。
 * 输出长边限制在 2048px，避免把超大原图直接上传。
 */
export async function cropImageToBlob(
  src: string,
  area: CropArea,
  maxLongEdge = 2048,
): Promise<Blob> {
  const image = await loadImage(src);
  const scale = Math.min(1, maxLongEdge / Math.max(area.width, area.height));
  const outputWidth = Math.max(1, Math.round(area.width * scale));
  const outputHeight = Math.max(1, Math.round(area.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器不支持 Canvas');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return canvasToBlob(canvas, 'image/jpeg', 0.92);
}

export async function rotateFile(
  file: File,
  degrees: 90 | 180 | 270,
): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const radians = (degrees * Math.PI) / 180;
    const swap = degrees === 90 || degrees === 270;
    const canvas = document.createElement('canvas');
    canvas.width = swap ? image.naturalHeight : image.naturalWidth;
    canvas.height = swap ? image.naturalWidth : image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持 Canvas');

    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(radians);
    context.drawImage(
      image,
      -image.naturalWidth / 2,
      -image.naturalHeight / 2,
    );

    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.94);
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-rotated.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function readImageSize(
  src: string,
): Promise<{ width: number; height: number }> {
  return loadImage(src).then((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
}
