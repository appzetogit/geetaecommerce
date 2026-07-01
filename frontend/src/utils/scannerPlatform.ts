import type { Html5QrcodeCameraScanConfig } from "html5-qrcode";
import { primeIosCameraFromUserGesture } from "./iosLiveCameraScanner";
import { IOS_WASM_READER_FORMATS } from "./scannerFormats";

export { IOS_WASM_READER_FORMATS };

/** Call from Scan button handlers before opening {@link QRScannerModal}. */
export function openBarcodeScanner(open: () => void): void {
  primeIosCameraFromUserGesture();
  open();
}

/** iPhone, iPod, iPad, and iPadOS desktop-mode Safari. */
export function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const isClassicIOS = /iPad|iPhone|iPod/i.test(ua);
  const isIPadDesktopMode =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return isClassicIOS || isIPadDesktopMode;
}

type ScannerProfile = {
  id: "ios" | "default";
  label: string;
  useWasmDecoder: boolean;
  scanConfig: Html5QrcodeCameraScanConfig;
  hint: string;
};

function buildQrBox(
  viewfinderWidth: number,
  viewfinderHeight: number,
  ios: boolean
) {
  const width = Math.floor(Math.min(viewfinderWidth * (ios ? 0.92 : 0.9), ios ? 420 : 500));
  const height = Math.floor(
    Math.max(
      ios ? 100 : 120,
      Math.min(viewfinderHeight * (ios ? 0.55 : 0.7), width * (ios ? 0.45 : 0.8))
    )
  );
  return { width, height };
}

export function getScannerProfile(): ScannerProfile {
  if (isAppleMobile()) {
    return {
      id: "ios",
      label: "iOS Enhanced",
      useWasmDecoder: true,
      hint: "Hold the phone 15–30 cm from the barcode. Tap the preview if it freezes.",
      scanConfig: {
        fps: 10,
        disableFlip: false,
        // No aspectRatio or videoConstraints here — iOS Safari black-screens when
        // those are applied before the user gesture that starts playback.
        qrbox: (viewfinderWidth, viewfinderHeight) =>
          buildQrBox(viewfinderWidth, viewfinderHeight, true),
      },
    };
  }

  return {
    id: "default",
    label: "Enterprise Scanner v2.0",
    useWasmDecoder: false,
    hint: "Center the barcode inside the pink frame for best results.",
    scanConfig: {
      fps: 40,
      aspectRatio: 1.2,
      disableFlip: false,
      videoConstraints: {
        facingMode: "environment",
        focusMode: "continuous",
        whiteBalanceMode: "continuous",
        exposureMode: "continuous",
      } as MediaTrackConstraints,
      qrbox: (viewfinderWidth, viewfinderHeight) =>
        buildQrBox(viewfinderWidth, viewfinderHeight, false),
    },
  };
}

export async function applyPostStartCameraEnhancements(
  scanner: {
    isScanning: boolean;
    applyVideoConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
    getRunningTrackCameraCapabilities: () => {
      zoomFeature: () => {
        isSupported: () => boolean;
        min: () => number;
        max: () => number;
      } | null;
    };
  },
  ios: boolean
): Promise<void> {
  if (!scanner.isScanning) return;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  await sleep(ios ? 800 : 400);

  if (!scanner.isScanning) return;

  const advanced: MediaTrackConstraintSet[] = [];

  try {
    const zoomFeature = scanner.getRunningTrackCameraCapabilities().zoomFeature();
    if (zoomFeature?.isSupported()) {
      const targetZoom = Math.min(ios ? 2 : 1.5, zoomFeature.max());
      if (targetZoom > zoomFeature.min()) {
        advanced.push({ zoom: targetZoom } as MediaTrackConstraintSet);
      }
    }
  } catch {
    /* zoom not supported */
  }

  if (ios) {
    advanced.push({ focusMode: "continuous" } as MediaTrackConstraintSet & {
      focusMode?: string;
    });
  }

  const attempts: MediaTrackConstraints[] = [];

  if (advanced.length > 0) {
    attempts.push({ advanced });
  }

  if (ios) {
    attempts.push({ focusMode: "continuous" } as MediaTrackConstraints);
    attempts.push({
      advanced: [{ focusMode: "continuous" }],
    } as unknown as MediaTrackConstraints);
  }

  for (const constraints of attempts) {
    if (!scanner.isScanning) return;
    try {
      await scanner.applyVideoConstraints(constraints);
      return;
    } catch {
      /* try next shape */
    }
  }
}
