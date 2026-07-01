import { useEffect, useRef, useState, useCallback, type ChangeEvent } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import {
  applyPostStartCameraEnhancements,
  getScannerProfile,
  isAppleMobile,
} from "../utils/scannerPlatform";
import {
  decodeBarcodeFromFileWithWasm,
  ensureIosVideoPlayback,
  findScannerVideoElement,
  patchIosVideoElement,
  prepareIosBarcodeWasm,
  startIosWasmVideoScan,
  waitForScannerVideo,
} from "../utils/iosWasmBarcodeScanner";

interface QRScannerModalProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: unknown) => void;
  onClose: () => void;
}

const BILLING_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.RSS_14,
  Html5QrcodeSupportedFormats.RSS_EXPANDED,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.PDF_417,
];

function createReaderElementId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `qr-scanner-${crypto.randomUUID()}`;
  }
  return `qr-scanner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function QRScannerModal({
  onScanSuccess,
  onScanFailure,
  onClose,
}: QRScannerModalProps) {
  const scannerProfile = getScannerProfile();
  const isIosProfile = scannerProfile.id === "ios";

  const readerIdRef = useRef<string | null>(null);
  if (!readerIdRef.current) {
    readerIdRef.current = createReaderElementId();
  }
  const readerId = readerIdRef.current;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const beginLiveScanRef = useRef<(() => Promise<void>) | null>(null);
  const afterCameraReadyRef = useRef<(() => Promise<void>) | null>(null);
  const stopWasmScanRef = useRef<(() => void) | null>(null);
  const handledRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanFailureRef = useRef(onScanFailure);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [iosAwaitingTap, setIosAwaitingTap] = useState(isIosProfile);
  const [iosStarting, setIosStarting] = useState(false);
  const [iosPreviewStalled, setIosPreviewStalled] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [isHighContrast, setIsHighContrast] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    const loadSound = async () => {
      try {
        const AudioContextClass =
          window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        const response = await fetch("/assets/sound/beep.mp3");
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBufferRef.current = audioBuffer;
      } catch (err) {
        console.warn("Failed to load beep sound:", err);
      }
    };

    void loadSound();

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const playBeep = useCallback(() => {
    const ctx = audioContextRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn("Failed to play beep:", e);
    }
  }, []);

  const unlockAudio = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  const startIosWasmLoop = useCallback(
    (onDecoded: (text: string) => void) => {
      if (!scannerProfile.useWasmDecoder) return;

      const tryAttach = (attempt = 0) => {
        if (handledRef.current || attempt > 30) return;

        const video = findScannerVideoElement(readerId);
        if (!video?.srcObject || !video.videoWidth) {
          window.setTimeout(() => tryAttach(attempt + 1), 200);
          return;
        }

        patchIosVideoElement(video);
        stopWasmScanRef.current = startIosWasmVideoScan(video, onDecoded);
      };

      tryAttach();
    },
    [readerId, scannerProfile.useWasmDecoder]
  );

  const finalizeIosPreview = useCallback(async () => {
    const video = await waitForScannerVideo(readerId);
    if (!video) {
      setIosPreviewStalled(true);
      setIosAwaitingTap(true);
      return false;
    }

    patchIosVideoElement(video);
    const playing = await ensureIosVideoPlayback(video);

    if (!playing) {
      setIosPreviewStalled(true);
      setIosAwaitingTap(true);
      return false;
    }

    setIosPreviewStalled(false);
    setIosAwaitingTap(false);
    return true;
  }, [readerId]);

  const resumeCameraPreview = useCallback(async () => {
    const video = findScannerVideoElement(readerId);
    if (!video) return;

    patchIosVideoElement(video);
    const playing = await ensureIosVideoPlayback(video);
    if (playing) {
      setIosPreviewStalled(false);
      setIosAwaitingTap(false);
    }
  }, [readerId]);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onScanFailureRef.current = onScanFailure;
  });

  useEffect(() => {
    handledRef.current = false;
    setCameraReady(false);
    setIosAwaitingTap(isIosProfile);
    setIosStarting(false);
    setIosPreviewStalled(false);
    setTorchOn(false);
    setTorchSupported(false);
    setZoom(1);

    if (scannerProfile.useWasmDecoder) {
      void prepareIosBarcodeWasm().catch((err) => {
        console.warn("QRScannerModal: WASM decoder preload failed", err);
      });
    }

    const scanner = new Html5Qrcode(readerId, {
      verbose: false,
      useBarCodeDetectorIfSupported: !scannerProfile.useWasmDecoder,
      formatsToSupport: BILLING_BARCODE_FORMATS,
    });
    scannerRef.current = scanner;

    const onDecoded = (decodedText: string) => {
      if (handledRef.current) return;

      if (navigator.vibrate) navigator.vibrate(60);
      playBeep();

      handledRef.current = true;
      stopWasmScanRef.current?.();
      stopWasmScanRef.current = null;

      const s = scannerRef.current;
      scannerRef.current = null;
      if (!s) {
        onScanSuccessRef.current(decodedText);
        return;
      }

      s.stop()
        .then(() => {
          s.clear();
          onScanSuccessRef.current(decodedText);
        })
        .catch(() => {
          try {
            s.clear();
          } catch {
            /* ignore */
          }
          onScanSuccessRef.current(decodedText);
        });
    };

    const afterCameraReady = async () => {
      setCameraReady(true);

      try {
        const caps = scanner.getRunningTrackCameraCapabilities();
        if (caps.torchFeature()?.isSupported()) {
          setTorchSupported(true);
        }

        const zoomFeature = caps.zoomFeature();
        if (zoomFeature?.isSupported()) {
          setZoomRange({
            min: zoomFeature.min(),
            max: zoomFeature.max(),
            step: zoomFeature.step(),
          });
          setZoom(zoomFeature.min());
        }
      } catch {
        setTorchSupported(false);
      }

      if (isIosProfile) {
        const previewOk = await finalizeIosPreview();
        if (!previewOk) return;
      }

      void applyPostStartCameraEnhancements(scanner, isIosProfile);
      startIosWasmLoop(onDecoded);
    };

    afterCameraReadyRef.current = afterCameraReady;

    const beginLiveScan = () =>
      scanner
        .start(
          { facingMode: "environment" },
          scannerProfile.scanConfig,
          (decodedText: string) => onDecoded(decodedText),
          (errorMessage: string, error: unknown) => {
            if (onScanFailureRef.current && !errorMessage?.includes("No barcode detected")) {
              onScanFailureRef.current(errorMessage ?? error);
            }
          }
        )
        .then(() => afterCameraReady());

    beginLiveScanRef.current = beginLiveScan;

    if (!isIosProfile) {
      beginLiveScan().catch((err: unknown) => {
        console.error("QRScannerModal: camera failed to start", err);
        setCameraReady(false);
      });
    }

    return () => {
      setCameraReady(false);
      stopWasmScanRef.current?.();
      stopWasmScanRef.current = null;

      const s = scannerRef.current;
      scannerRef.current = null;
      beginLiveScanRef.current = null;
      afterCameraReadyRef.current = null;

      if (!s) return;
      if (s.isScanning) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {
            try {
              s.clear();
            } catch {
              /* ignore */
            }
          });
      } else {
        try {
          s.clear();
        } catch {
          /* ignore */
        }
      }
    };
  }, [
    readerId,
    isIosProfile,
    playBeep,
    finalizeIosPreview,
    startIosWasmLoop,
    scannerProfile,
  ]);

  const handleIosStartCamera = () => {
    unlockAudio();
    setIosAwaitingTap(false);
    setIosPreviewStalled(false);
    setIosStarting(true);

    const start = beginLiveScanRef.current;
    if (!start) {
      setIosStarting(false);
      setIosAwaitingTap(true);
      return;
    }

    // Must invoke scanner.start() synchronously inside the tap handler for iOS Safari.
    void start()
      .catch((err: unknown) => {
        console.error("QRScannerModal: iOS camera failed to start", err);
        setCameraReady(false);
        setIosAwaitingTap(true);
      })
      .finally(() => {
        setIosStarting(false);
      });
  };

  const handlePreviewTap = () => {
    unlockAudio();
    if (iosAwaitingTap && !cameraReady) {
      handleIosStartCamera();
      return;
    }
    void resumeCameraPreview();
  };

  const handleZoomChange = async (newZoom: number) => {
    const scanner = scannerRef.current;
    if (!scanner?.isScanning) return;
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ zoom: newZoom } as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
      setZoom(newZoom);
    } catch (err) {
      console.error("Failed to apply zoom", err);
    }
  };

  const handleGalleryPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const scanner = scannerRef.current;
    if (!file || !scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      stopWasmScanRef.current?.();
      stopWasmScanRef.current = null;

      let text: string | null = null;
      if (scannerProfile.useWasmDecoder) {
        text = await decodeBarcodeFromFileWithWasm(file);
      }
      if (!text) {
        text = await scanner.scanFile(file, false);
      }

      if (handledRef.current) return;
      handledRef.current = true;
      try {
        scanner.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
      playBeep();
      onScanSuccessRef.current(text);
    } catch {
      handledRef.current = false;
      try {
        if (isIosProfile) {
          setIosAwaitingTap(true);
        } else {
          await beginLiveScanRef.current?.();
        }
      } catch (err) {
        console.error("QRScannerModal: could not resume camera after file scan", err);
      }
    }
  };

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner?.isScanning || !torchSupported) return;
    const next = !torchOn;
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      try {
        await scanner.applyVideoConstraints({ torch: next } as MediaTrackConstraints);
        setTorchOn(next);
      } catch {
        /* device may not support torch */
      }
    }
  };

  const showIosStartOverlay = isIosProfile && (iosAwaitingTap || iosStarting);
  const showIosResumeOverlay = isIosProfile && cameraReady && iosPreviewStalled && !iosStarting;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm p-4"
      onClick={unlockAudio}
      onTouchStart={unlockAudio}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => {
          e.stopPropagation();
          unlockAudio();
        }}
      >
        <style>{`
          #${readerId} {
            position: relative !important;
            min-height: 300px;
          }
          #${readerId} video {
            width: 100% !important;
            height: 100% !important;
            min-height: 300px !important;
            object-fit: cover !important;
            display: block !important;
            background: #000 !important;
          }
        `}</style>

        <div className="flex justify-between items-center py-2.5 px-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-800 leading-tight">Scan barcode</h3>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
              {scannerProfile.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close scanner"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
          {isIosProfile && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-800 leading-relaxed">
              {iosAwaitingTap
                ? "Tap Start Camera below — iPhone requires a direct tap to show the live preview."
                : "Hold steady 15–30 cm from the barcode. Tap the preview if it freezes."}
            </div>
          )}

          <div className="flex justify-between items-center gap-2">
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setIsHighContrast(!isHighContrast)}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                isHighContrast
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {isHighContrast ? "🌓 High Contrast" : "🌓 Normal"}
            </button>
          </div>

          {zoomRange.max > zoomRange.min && (
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                <span>Zoom Control</span>
                <span className="text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-full">
                  {zoom.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step}
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
              />
            </div>
          )}

          <div className="relative group">
            <div
              id={readerId}
              role="button"
              tabIndex={0}
              onClick={handlePreviewTap}
              onTouchEnd={(e) => {
                e.preventDefault();
                handlePreviewTap();
              }}
              className={`w-full h-[300px] rounded-xl overflow-hidden border-2 border-gray-200 bg-black transition-all ${
                isHighContrast ? "contrast-150 brightness-110 saturate-0" : ""
              }`}
            />

            {(showIosStartOverlay || showIosResumeOverlay) && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/70 p-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showIosStartOverlay) {
                      handleIosStartCamera();
                    } else {
                      void resumeCameraPreview();
                    }
                  }}
                  disabled={iosStarting}
                  className="rounded-2xl bg-white px-6 py-4 text-center shadow-xl active:scale-95 transition-transform disabled:opacity-60"
                >
                  <div className="text-3xl mb-2">📷</div>
                  <div className="text-sm font-bold text-gray-900">
                    {iosStarting
                      ? "Starting camera..."
                      : showIosResumeOverlay
                        ? "Tap to resume preview"
                        : "Start Camera"}
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Required on iPhone Safari
                  </div>
                </button>
              </div>
            )}

            {cameraReady && !showIosStartOverlay && !showIosResumeOverlay && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[85%] h-[70%] border-2 border-pink-500 rounded-lg relative">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white rounded-br" />
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-pink-500/50 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-center shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleGalleryPick}
            />
            {isIosProfile && iosAwaitingTap && (
              <button
                type="button"
                onClick={handleIosStartCamera}
                disabled={iosStarting}
                className="flex-1 px-4 py-2.5 text-sm font-bold rounded-xl bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 shadow-sm transition-all"
              >
                {iosStarting ? "Starting..." : "Start Camera"}
              </button>
            )}
            <button
              type="button"
              disabled={!cameraReady && !isIosProfile}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2.5 text-sm font-bold rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm transition-all"
            >
              {isIosProfile ? "Photo of Barcode" : "Upload Image"}
            </button>
            {torchSupported && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className={`px-4 py-2.5 text-sm font-bold rounded-xl border transition-all shadow-sm ${
                  torchOn
                    ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
              >
                {torchOn ? "🔦 Flash ON" : "🔦 Flash OFF"}
              </button>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white shrink-0">
          <p className="text-center text-[11px] text-gray-400 italic">{scannerProfile.hint}</p>
        </div>
      </div>
    </div>
  );
}

export { isAppleMobile };
