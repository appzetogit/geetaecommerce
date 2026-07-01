import {
  prepareZXingModule,
  readBarcodes,
  type ReaderOptions,
} from "zxing-wasm/reader";
import { IOS_WASM_READER_FORMATS } from "./scannerFormats";
import { patchIosVideoElement } from "./iosLiveCameraScanner";

let wasmReadyPromise: Promise<void> | null = null;

const WASM_READER_OPTIONS: ReaderOptions = {
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  formats: [...IOS_WASM_READER_FORMATS],
  maxNumberOfSymbols: 1,
};

export function prepareIosBarcodeWasm(): Promise<void> {
  if (!wasmReadyPromise) {
    wasmReadyPromise = prepareZXingModule({ fireImmediately: true }).then(() => undefined);
  }
  return wasmReadyPromise;
}

export async function decodeBarcodeFromFileWithWasm(file: Blob): Promise<string | null> {
  await prepareIosBarcodeWasm();
  try {
    const results = await readBarcodes(file, WASM_READER_OPTIONS);
    return results[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

export function startIosWasmVideoScan(
  video: HTMLVideoElement,
  onFound: (text: string) => void
): () => void {
  let active = true;
  let busy = false;
  let lastFrameAt = 0;
  const frameIntervalMs = 160;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  const tick = async (now: number) => {
    if (!active || busy || !context) return;

    if (now - lastFrameAt < frameIntervalMs) {
      if (active) requestAnimationFrame(tick);
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (active) requestAnimationFrame(tick);
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      if (active) requestAnimationFrame(tick);
      return;
    }

    lastFrameAt = now;
    busy = true;

    try {
      await prepareIosBarcodeWasm();

      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const results = await readBarcodes(imageData, WASM_READER_OPTIONS);
      const text = results[0]?.text?.trim();

      if (text && active) {
        active = false;
        onFound(text);
        return;
      }
    } catch {
      /* no barcode in frame */
    } finally {
      busy = false;
      if (active) requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);

  return () => {
    active = false;
  };
}

export function findScannerVideoElement(containerId: string): HTMLVideoElement | null {
  const container = document.getElementById(containerId);
  if (!container) return null;
  return container.querySelector("video");
}

export async function ensureIosVideoPlayback(video: HTMLVideoElement): Promise<boolean> {
  patchIosVideoElement(video);

  if (!video.srcObject && video.paused) {
    return false;
  }

  try {
    await video.play();
  } catch {
    return false;
  }

  return (
    !video.paused &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0
  );
}

export function waitForScannerVideo(
  containerId: string,
  timeoutMs = 4000
): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const started = Date.now();

    const poll = () => {
      const video = findScannerVideoElement(containerId);
      if (video?.srcObject) {
        resolve(video);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(video);
        return;
      }
      window.setTimeout(poll, 100);
    };

    poll();
  });
}
