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

  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onScanFailureRef.current = onScanFailure;
  });

  useEffect(() => {
    handledRef.current = false;
    setCameraReady(false);
    setTorchOn(false);
    setTorchSupported(false);

    const scanner = new Html5Qrcode(readerId, {
      verbose: false,
      useBarCodeDetectorIfSupported: true,
      formatsToSupport: BILLING_BARCODE_FORMATS,
    });
    scannerRef.current = scanner;

    const scanConfig = {
      fps: 20,
      aspectRatio: 1.7777778,
      disableFlip: false,
      videoConstraints: { facingMode: "environment" as const },
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const width = Math.floor(Math.min(viewfinderWidth * 0.96, 800));
        const height = Math.floor(
          Math.max(110, Math.min(viewfinderHeight * 0.45, width * 0.48))
        );
        return { width, height };
      },
    };

    const onDecoded = (decodedText: string) => {
      if (handledRef.current) return;
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
              onScanFailureRef.current(errorMessage ?? error);
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
  }, [readerId]);

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
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Scan barcode</h3>
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

        <div className="p-4 bg-gray-50 space-y-3">
          <div
            id={readerId}
            className="w-full min-h-[280px] rounded-lg overflow-hidden border-2 border-dashed border-gray-300 bg-black"
          />

          <div className="flex flex-wrap gap-2 justify-center">
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
              className="px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Use photo
            </button>
            {torchSupported && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-800 hover:bg-gray-50"
              >
                {torchOn ? "Light off" : "Light on"}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 leading-relaxed">
            Align the whole barcode inside the frame. For glossy labels, tilt
            slightly to reduce glare, or tap <strong>Use photo</strong> and
            pick a sharp picture.
          </p>
        </div>
      </div>
    </div>
  );
}
