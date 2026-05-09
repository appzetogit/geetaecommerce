// import { useEffect, useRef } from "react";
// import { Html5QrcodeScanner } from "html5-qrcode";

// interface QRScannerModalProps {
//   onScanSuccess: (decodedText: string) => void;
//   onScanFailure?: (error: any) => void;
//   onClose: () => void;
// }

// export default function QRScannerModal({
//   onScanSuccess,
//   onScanFailure,
//   onClose,
// }: QRScannerModalProps) {
//   const scannerRef = useRef<Html5QrcodeScanner | null>(null);

//   useEffect(() => {
//     // Initialize scanner with slightly delayed start to ensure DOM is ready
//     const timer = setTimeout(() => {
//         scannerRef.current = new Html5QrcodeScanner(
//             "reader",
//             {
//               fps: 10,
//               qrbox: { width: 250, height: 250 },
//               aspectRatio: 1.0,
//               showTorchButtonIfSupported: true,
//               // Ideally prefer back camera
//               videoConstraints: {
//                   facingMode: "environment"
//               }
//             },
//             /* verbose= */ false
//         );

//         scannerRef.current.render(
//             (decodedText) => {
//                 // Success callback
//                 onScanSuccess(decodedText);
//                 // Auto-stop scanning on success
//                 if (scannerRef.current) {
//                     scannerRef.current.clear().catch(console.error);
//                 }
//             },
//             (errorMessage) => {
//                 // Failure callback (optional logging)
//                 if (onScanFailure) onScanFailure(errorMessage);
//             }
//         );
//     }, 100);

//     return () => {
//       clearTimeout(timer);
//       if (scannerRef.current) {
//         scannerRef.current.clear().catch(console.error);
//       }
//     };
//   }, []); // Run once on mount

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm p-4">
//       <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
//         {/* Header */}
//         <div className="flex justify-between items-center p-4 border-b border-gray-100">
//           <h3 className="text-lg font-bold text-gray-800">Scan QR / Barcode</h3>
//           <button
//             onClick={onClose}
//             className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
//           >
//             <svg
//               width="24"
//               height="24"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <line x1="18" y1="6" x2="6" y2="18"></line>
//               <line x1="6" y1="6" x2="18" y2="18"></line>
//             </svg>
//           </button>
//         </div>

//         {/* Scanner Area */}
//         <div className="p-4 bg-gray-50">
//             <style>{`
//                 #reader__status_span,
//                 #reader__header_message {
//                     display: none !important;
//                 }
//             `}</style>
//             <div id="reader" className="w-full rounded-lg overflow-hidden border-2 border-dashed border-gray-300"></div>
//             <p className="text-center text-xs text-gray-500 mt-3">
//                 Point your camera at a QR code or Barcode
//             </p>
//         </div>
//       </div>
//     </div>
//   );
// }


import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

interface QRScannerModalProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: unknown) => void;
  onClose: () => void;
}

/**
 * Formats common on retail / billing labels (1D linear + occasional QR / 2D on receipts).
 * Explicit list helps the decoder prioritize real product codes over noise.
 */
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
  const readerIdRef = useRef<string | null>(null);
  if (!readerIdRef.current) {
    readerIdRef.current = createReaderElementId();
  }
  const readerId = readerIdRef.current;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const beginLiveScanRef = useRef<(() => Promise<void>) | null>(null);
  const handledRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanFailureRef = useRef(onScanFailure);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // High-accuracy buffer: tracks the last detected code to ensure consistency
  const lastDetectedCodeRef = useRef<{ code: string; count: number }>({ code: "", count: 0 });

  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  
  // Advanced Features State
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [isHighContrast, setIsHighContrast] = useState(false);

  // Helper: Synthesize a sharp 'beep' sound for instant feedback
  const playBeep = (freq = 880) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime); 
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      /* ignore audio errors */
    }
  };

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onScanFailureRef.current = onScanFailure;
  });

  useEffect(() => {
    handledRef.current = false;
    lastDetectedCodeRef.current = { code: "", count: 0 };
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

    const scanConfig = {
      fps: 40,
      aspectRatio: 1.6,
      disableFlip: false,
      videoConstraints: {
        facingMode: "environment" as const,
        focusMode: "continuous" as const,
        whiteBalanceMode: "continuous" as const,
        exposureMode: "continuous" as const
      },
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const width = Math.floor(Math.min(viewfinderWidth * 0.9, 500));
        const height = Math.floor(Math.max(100, Math.min(viewfinderHeight * 0.6, width * 0.4)));
        return { width, height };
      },
    };

    const onDecoded = (decodedText: string) => {
      if (handledRef.current) return;

      if (lastDetectedCodeRef.current.code !== decodedText) {
        lastDetectedCodeRef.current = { code: decodedText, count: 1 };
        return;
      } else {
        lastDetectedCodeRef.current.count += 1;
      }

      if (lastDetectedCodeRef.current.count < 2) return;

      // Instant Feedback
      if (navigator.vibrate) navigator.vibrate(60);
      playBeep(880);



      handledRef.current = true;
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

    const beginLiveScan = () => {
      return scanner
        .start(
          { facingMode: "environment" },
          scanConfig,
          (decodedText: string) => onDecoded(decodedText),
          (errorMessage: string, error: unknown) => {
            if (onScanFailureRef.current) {
              if (!errorMessage?.includes("No barcode detected")) {
                onScanFailureRef.current(errorMessage ?? error);
              }
            }
          }
        )
        .then(() => {
          setCameraReady(true);
          try {
            const caps = scanner.getRunningTrackCameraCapabilities();
            if (caps.torchFeature()?.isSupported()) {
              setTorchSupported(true);
            }
            
            // Detect Zoom Capabilities
            const zoomFeature = caps.zoomFeature();
            if (zoomFeature?.isSupported()) {
              setZoomRange({
                min: zoomFeature.min(),
                max: zoomFeature.max(),
                step: zoomFeature.step()
              });
              setZoom(zoomFeature.min());
            }
          } catch {
            setTorchSupported(false);
          }
        });
    };

    beginLiveScanRef.current = beginLiveScan;

    beginLiveScan().catch((err: unknown) => {
      console.error("QRScannerModal: camera failed to start", err);
      setCameraReady(false);
    });

    return () => {
      setCameraReady(false);
      lastDetectedCodeRef.current = { code: "", count: 0 };
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
  }, [readerId]); // Re-start if readerId changes

  const handleZoomChange = async (newZoom: number) => {
    const scanner = scannerRef.current;
    if (!scanner?.isScanning) return;
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ zoom: newZoom } as any],
      } as any);
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
      const text = await scanner.scanFile(file, false);
      if (handledRef.current) return;
      handledRef.current = true;
      try {
        scanner.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
      onScanSuccessRef.current(text);
    } catch {
      handledRef.current = false;
      try {
        await beginLiveScanRef.current?.();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center py-2.5 px-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-800 leading-tight">Scan barcode</h3>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Enterprise Scanner v2.0</p>
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
          {/* Top Controls */}
          <div className="flex justify-between items-center gap-2">
             <div className="flex-1">
                {/* Space for symmetry or other controls */}
             </div>
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

          {/* Zoom Control */}
          {zoomRange.max > zoomRange.min && (
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                 <span className="flex items-center gap-1">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                     <circle cx="11" cy="11" r="8"></circle>
                     <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                     <line x1="11" y1="8" x2="11" y2="14"></line>
                     <line x1="8" y1="11" x2="14" y2="11"></line>
                   </svg>
                   Zoom Control
                 </span>
                 <span className="text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-full">{zoom.toFixed(1)}x</span>
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

          {/* Scanner Viewport */}
          <div className="relative group">
            <div
              id={readerId}
              className={`w-full h-[220px] rounded-xl overflow-hidden border-2 border-gray-200 bg-black transition-all ${
                isHighContrast ? "contrast-150 brightness-110 saturate-0" : ""
              }`}
            />
            
            {/* Viewfinder Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="w-[85%] h-[60%] border-2 border-pink-500 rounded-lg shadow-[0_0_0_2000px_rgba(0,0,0,0.4)] relative">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white rounded-tl"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white rounded-tr"></div>
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white rounded-bl"></div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white rounded-br"></div>
                  
                  {/* Scanning Line */}
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-pink-500/50 shadow-[0_0_8px_rgba(236,72,153,0.8)] animate-pulse"></div>
               </div>
            </div>
          </div>



          {/* Bottom Actions */}
          <div className="flex flex-wrap gap-2 justify-center shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGalleryPick}
            />
            <button
              type="button"
              disabled={!cameraReady}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2.5 text-sm font-bold rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm transition-all"
            >
              Upload Image
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
          <p className="text-center text-[11px] text-gray-400 italic">
            Center the barcode inside the pink frame for best results.
          </p>
        </div>
      </div>
    </div>
  );
}
