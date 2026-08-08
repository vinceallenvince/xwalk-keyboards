export const COMPOSITE_COLUMNS = 4;
export const COMPOSITE_ROWS = 3;
export const COMPOSITE_CELL_WIDTH = 396;
export const COMPOSITE_IMAGE_HEIGHT = 269;
export const COMPOSITE_LABEL_HEIGHT = 28;
export const COMPOSITE_CELL_HEIGHT = COMPOSITE_IMAGE_HEIGHT + COMPOSITE_LABEL_HEIGHT;
export const COMPOSITE_WIDTH = COMPOSITE_COLUMNS * COMPOSITE_CELL_WIDTH;
export const COMPOSITE_HEIGHT = COMPOSITE_ROWS * COMPOSITE_CELL_HEIGHT;
export const CAMERA_INFO_HEADER_CROP_RATIO = 1 / 12;

export type CompositeFrame = { imageUrl: string };

export function getCompositeCellLayout(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= 12) throw new Error("Composite cell index must be between 0 and 11");
  return {
    height: COMPOSITE_CELL_HEIGHT,
    imageHeight: COMPOSITE_IMAGE_HEIGHT,
    labelHeight: COMPOSITE_LABEL_HEIGHT,
    width: COMPOSITE_CELL_WIDTH,
    x: (index % COMPOSITE_COLUMNS) * COMPOSITE_CELL_WIDTH,
    y: Math.floor(index / COMPOSITE_COLUMNS) * COMPOSITE_CELL_HEIGHT,
  };
}

export function getCameraImageSourceCrop(sourceWidth: number, sourceHeight: number, destinationWidth: number, destinationHeight: number) {
  const headerHeight = sourceHeight * CAMERA_INFO_HEADER_CROP_RATIO;
  let height = sourceHeight - headerHeight;
  let width = sourceWidth;
  let x = 0;
  let y = headerHeight;
  const sourceAspect = width / height;
  const destinationAspect = destinationWidth / destinationHeight;
  if (sourceAspect > destinationAspect) {
    width = height * destinationAspect;
    x = (sourceWidth - width) / 2;
  } else if (sourceAspect < destinationAspect) {
    height = width / destinationAspect;
    y = sourceHeight - height;
  }
  return { height, width, x, y };
}

function loadImage(imageUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load an annotated camera frame"));
    image.src = imageUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Browser could not export the camera composite")), "image/jpeg", 0.9);
  });
}

export async function createCrosswalkComposite(frames: readonly CompositeFrame[]) {
  if (frames.length !== 12) throw new Error("A composite requires exactly twelve frozen frames");
  const canvas = document.createElement("canvas");
  canvas.width = COMPOSITE_WIDTH;
  canvas.height = COMPOSITE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D rendering is unavailable");
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const images = await Promise.all(frames.map((frame) => loadImage(frame.imageUrl)));
  images.forEach((image, index) => {
    const cell = getCompositeCellLayout(index);
    const crop = getCameraImageSourceCrop(image.naturalWidth, image.naturalHeight, cell.width, cell.imageHeight);
    context.fillStyle = "#07110f";
    context.fillRect(cell.x, cell.y, cell.width, cell.labelHeight);
    context.fillStyle = "#80d9b2";
    context.font = "600 16px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textBaseline = "middle";
    context.fillText(String(index + 1).padStart(2, "0"), cell.x + 10, cell.y + cell.labelHeight / 2);
    context.fillStyle = "#000";
    context.fillRect(cell.x, cell.y + cell.labelHeight, cell.width, cell.imageHeight);
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, cell.x, cell.y + cell.labelHeight, cell.width, cell.imageHeight);
    context.strokeStyle = "rgba(128, 217, 178, .35)";
    context.strokeRect(cell.x + .5, cell.y + .5, cell.width - 1, cell.height - 1);
  });
  return canvasToBlob(canvas);
}
