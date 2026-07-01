import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, type ChangeEvent } from "react";
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
  applyIosStreamEnhancements,
  isIosTorchSupported,
  readIosZoomRange,
  requestIosCameraStream,
  setIosTorch,
  setIosZoom,
  startIosVideoPreview,
  stopMediaStream,
  takePrimedIosCameraStream,
} from "../utils/iosLiveCameraScanner";
import {
  decodeBarcodeFromFileWithWasm,
  ensureIosVideoPlayback,
  prepareIosBarcodeWasm,
  startIosWasmVideoScan,
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
  const scannerProfile = useMemo(() => getScannerProfile(), []);
  const isIosProfile = scannerProfile.id === "ios";

  const readerIdRef = useRef<string | null>(null);
  if (!readerIdRef.current) {
    readerIdRef.current = createReaderElementId();
  }
  const readerId = readerIdRef.current;

  // Android: html5-qrcode
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const beginLiveScanRef = useRef<(() => Promise<void>) | null>(null);

  // iOS: native camera + WASM
  const iosVideoRef = useRef<HTMLVideoElement | null>(null);
  const iosStreamRef = useRef<MediaStream | null>(null);
  const stopWasmScanRef = useRef<(() => void) | null>(null);

  const handledRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanFailureRef = useRef(onScanFailure);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [iosStarting, setIosStarting] = useState(false);
  const [iosPreviewStalled, setIosPreviewStalled] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [isHighContrast, setIsHighContrast] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const stopIosCamera = useCallback(() => {
    stopWasmScanRef.current?.();
    stopWasmScanRef.current = null;
    stopMediaStream(iosStreamRef.current);
    iosStreamRef.current = null;
    const video = iosVideoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const playBeep = useCallback(() => {
    const ctx = audioContextRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      /* ignore */
    }
  }, []);

  const finishScan = useCallback(
    (decodedText: string) => {
      if (handledRef.current) return;
      handledRef.current = true;

      if (navigator.vibrate) navigator.vibrate(60);
      playBeep();

      if (isIosProfile) {
        stopIosCamera();
      } else {
        stopWasmScanRef.current = null;
        const s = scannerRef.current;
        scannerRef.current = null;
        if (s) {
          s.stop()
            .then(() => s.clear())
            .catch(() => {
              try {
                s.clear();
              } catch {
                /* ignore */
              }
            });
        }
      }

      onScanSuccessRef.current(decodedText);
    },
    [isIosProfile, stopIosCamera, playBeep]
  );

  const unlockAudio = useCallback(() => {
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const loadSound = async () => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        const response = await fetch("/assets/sound/beep.mp3");
        const arrayBuffer = await response.arrayBuffer();
        audioBufferRef.current = await ctx.decodeAudioData(arrayBuffer);
      } catch (err) {
        console.warn("Failed to load beep sound:", err);
      }
    };
    void loadSound();
    return () => {
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onScanFailureRef.current = onScanFailure;
  });

  // ─── iOS: WASM preload + auto-start from Scan-button gesture ───
  const attachIosStream = useCallback(
    async (streamPromise: Promise<MediaStream>) => {
      const video = iosVideoRef.current;
      if (!video) return;

      setIosStarting(true);
      setIosPreviewStalled(false);

      try {
        const stream = await streamPromise;
        iosStreamRef.current = stream;
        await startIosVideoPreview(video, stream);

        setTorchSupported(isIosTorchSupported(stream));
        const zr = readIosZoomRange(stream);
        if (zr && zr.max > zr.min) {
          setZoomRange(zr);
          setZoom(zr.min);
        }

        void applyIosStreamEnhancements(stream);
        stopWasmScanRef.current = startIosWasmVideoScan(video, (text) => finishScan(text));
        setCameraReady(true);
        setIosPreviewStalled(false);
      } catch (err: unknown) {
        console.error("QRScannerModal: iOS camera failed", err);
        stopIosCamera();
        setCameraReady(false);
        setIosPreviewStalled(true);
        onScanFailureRef.current?.(err);
      } finally {
        setIosStarting(false);
      }
    },
    [finishScan, stopIosCamera]
  );

  useEffect(() => {
    if (!isIosProfile) return;

    handledRef.current = false;
    setCameraReady(false);
    setIosStarting(false);
    setIosPreviewStalled(false);
    setTorchOn(false);
    setTorchSupported(false);
    setZoom(1);

    void prepareIosBarcodeWasm().catch((err) => {
      console.warn("QRScannerModal: WASM preload failed", err);
    });

    return () => {
      stopIosCamera();
      setCameraReady(false);
    };
  }, [isIosProfile, stopIosCamera]);

  useLayoutEffect(() => {
    if (!isIosProfile) return;

    const primed = takePrimedIosCameraStream();
    if (primed) {
      void attachIosStream(primed);
      return;
    }

    // Scan opened without priming — request on mount (may fail on some iOS versions).
    void attachIosStream(requestIosCameraStream());
  }, [isIosProfile, attachIosStream]);

  // ─── Android: unchanged html5-qrcode path ───
  useEffect(() => {
    if (isIosProfile) return;

    handledRef.current = false;
    setCameraReady(false);
    setTorchOn(false);
    setTorchSupported(false);
    setZoom(1);

    const scanner = new Html5Qrcode(readerId, {
      verbose: false,
      useBarCodeDetectorIfSupported: true,
      formatsToSupport: BILLING_BARCODE_FORMATS,
    });
    scannerRef.current = scanner;

    const onDecoded = (decodedText: string) => finishScan(decodedText);

    const beginLiveScan = () =>
      scanner
        .start(
          { facingMode: "environment" },
          scannerProfile.scanConfig,
          onDecoded,
          (errorMessage: string, error: unknown) => {
            if (onScanFailureRef.current && !errorMessage?.includes("No barcode detected")) {
              onScanFailureRef.current(errorMessage ?? error);
            }
          }
        )
        .then(async () => {
          setCameraReady(true);
          try {
            const caps = scanner.getRunningTrackCameraCapabilities();
            if (caps.torchFeature()?.isSupported()) setTorchSupported(true);
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
          await applyPostStartCameraEnhancements(scanner, false);
        });

    beginLiveScanRef.current = beginLiveScan;

    beginLiveScan().catch((err: unknown) => {
      console.error("QRScannerModal: camera failed to start", err);
      setCameraReady(false);
    });

    return () => {
      setCameraReady(false);
      const s = scannerRef.current;
      scannerRef.current = null;
      beginLiveScanRef.current = null;
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
  }, [readerId, isIosProfile, finishScan, scannerProfile]);

  const resumeIosPreview = useCallback(async () => {
    const video = iosVideoRef.current;
    if (!video?.srcObject) {
      void attachIosStream(requestIosCameraStream());
      return;
    }
    const playing = await ensureIosVideoPlayback(video);
    setIosPreviewStalled(!playing);
  }, [attachIosStream]);

  const handlePreviewTap = () => {
    unlockAudio();
    if (isIosProfile && (iosPreviewStalled || !cameraReady)) {
      void resumeIosPreview();
    }
  };

  const handleZoomChange = async (newZoom: number) => {
    if (isIosProfile) {
      try {
        await setIosZoom(iosStreamRef.current, newZoom);
        setZoom(newZoom);
      } catch (err) {
        console.error("Failed to apply iOS zoom", err);
      }
      return;
    }

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
    if (!file) return;

    try {
      if (isIosProfile) {
        stopIosCamera();
        setCameraReady(false);
      } else {
        const scanner = scannerRef.current;
        if (!scanner) return;
        if (scanner.isScanning) await scanner.stop();
      }

      let text: string | null = null;
      if (isIosProfile) {
        text = await decodeBarcodeFromFileWithWasm(file);
      } else {
        const scanner = scannerRef.current;
        if (scanner) text = await scanner.scanFile(file, false);
      }

      if (!text) throw new Error("No barcode found in image");
      if (handledRef.current) return;

      if (!isIosProfile) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        try {
          scanner?.clear();
        } catch {
          /* ignore */
        }
      }

      handledRef.current = true;
      playBeep();
      onScanSuccessRef.current(text);
    } catch (err) {
      handledRef.current = false;
      if (isIosProfile) {
        void attachIosStream(requestIosCameraStream());
      } else {
        try {
          await beginLiveScanRef.current?.();
        } catch (resumeErr) {
          console.error("QRScannerModal: could not resume camera", resumeErr);
        }
      }
      onScanFailureRef.current?.(err);
    }
  };

  const toggleTorch = async () => {
    const next = !torchOn;
    if (isIosProfile) {
      try {
        await setIosTorch(iosStreamRef.current, next);
        setTorchOn(next);
      } catch {
        /* not supported */
      }
      return;
    }

    const scanner = scannerRef.current;
    if (!scanner?.isScanning || !torchSupported) return;
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
        /* ignore */
      }
    }
  };

  const showIosLoading = isIosProfile && iosStarting;
  const showViewfinder = cameraReady && !showIosLoading;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 p-4 ${
        isIosProfile ? "" : "backdrop-blur-sm"
      }`}
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
        {!isIosProfile && (
          <style>{`
            #${readerId} video {
              width: 100% !important;
              height: 100% !important;
              min-height: 300px !important;
              object-fit: cover !important;
            }
          `}</style>
        )}

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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
          {isIosProfile && iosPreviewStalled && !iosStarting && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
              Camera paused — tap the preview to resume.
            </div>
          )}

          <div className="flex justify-end">
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
                <span>Zoom</span>
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

          <div className="relative">
            {isIosProfile ? (
              <video
                ref={iosVideoRef}
                playsInline
                muted
                autoPlay
                onClick={handlePreviewTap}
                className={`w-full h-[300px] rounded-xl overflow-hidden border-2 border-gray-200 bg-black object-cover ${
                  isHighContrast ? "contrast-150 brightness-110 saturate-0" : ""
                }`}
              />
            ) : (
              <div
                id={readerId}
                className={`w-full h-[300px] rounded-xl overflow-hidden border-2 border-gray-200 bg-black ${
                  isHighContrast ? "contrast-150 brightness-110 saturate-0" : ""
                }`}
              />
            )}

            {showIosLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}

            {showViewfinder && (
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
            <button
              type="button"
              disabled={!cameraReady && !isIosProfile}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2.5 text-sm font-bold rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm"
            >
              {isIosProfile ? "Photo of Barcode" : "Upload Image"}
            </button>
            {torchSupported && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className={`px-4 py-2.5 text-sm font-bold rounded-xl border shadow-sm ${
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
