import { useRef } from "react";
import { useState } from "react";
import { useEffect } from "react";
import QrScanner from "qr-scanner";

export function WebQrScanner({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (value: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let timer = 0;
    let scannerInstance: QrScanner | null = null;
    const start = async () => {
      try {
        if (!video.current) return;
        scannerInstance = new QrScanner(
          video.current,
          (result) => {
            onDetected(typeof result === "string" ? result : result.data);
          },
          { highlightScanRegion: true, returnDetailedScanResult: true },
        );
        await scannerInstance.start();
        timer = window.setTimeout(() => scannerInstance?.stop(), 120000);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Unable to access the camera.",
        );
      }
    };
    start();
    return () => {
      window.clearTimeout(timer);
      scannerInstance?.destroy();
    };
  }, [onDetected]);
  return (
    <div className="modal-backdrop">
      <div className="qr-modal" role="dialog" aria-label="Scan reservation QR">
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">GRID OPERATOR SCANNER</p>
        <h2>Scan transaction QR</h2>
        {error ? (
          <p className="form-error">{error}</p>
        ) : (
          <video ref={video} className="qr-camera" playsInline muted />
        )}
        <button className="secondary-button wide" onClick={onClose}>
          Close scanner
        </button>
      </div>
    </div>
  );
}
