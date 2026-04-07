import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerModalProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
  onClose: () => void;
}

export default function QRScannerModal({
  onScanSuccess,
  onScanFailure,
  onClose,
}: QRScannerModalProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Initialize scanner with slightly delayed start to ensure DOM is ready
    const timer = setTimeout(() => {
        scannerRef.current = new Html5QrcodeScanner(
            "reader",
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
              showTorchButtonIfSupported: true,
              // Ideally prefer back camera
              videoConstraints: {
                  facingMode: "environment"
              }
            },
            /* verbose= */ false
        );

        scannerRef.current.render(
            (decodedText) => {
                // Success callback
                onScanSuccess(decodedText);
                // Auto-stop scanning on success
                if (scannerRef.current) {
                    scannerRef.current.clear().catch(console.error);
                }
            },
            (errorMessage) => {
                // Failure callback (optional logging)
                if (onScanFailure) onScanFailure(errorMessage);
            }
        );
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []); // Run once on mount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Scan QR / Barcode</h3>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
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

        {/* Scanner Area */}
        <div className="p-4 bg-gray-50">
            <style>{`
                #reader__status_span,
                #reader__header_message {
                    display: none !important;
                }
            `}</style>
            <div id="reader" className="w-full rounded-lg overflow-hidden border-2 border-dashed border-gray-300"></div>
            <p className="text-center text-xs text-gray-500 mt-3">
                Point your camera at a QR code or Barcode
            </p>
        </div>
      </div>
    </div>
  );
}
