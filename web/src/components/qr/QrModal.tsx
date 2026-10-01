import { X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Check } from "lucide-react";

export function QrModal({
  value,
  onClose,
}: {
  value: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="qr-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Reservation QR code"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <p className="eyebrow">APPROVED RESERVATION</p>
        <h2>Ready for the sun.</h2>
        <p className="muted">
          Show this code at the station to complete the energy transfer.
        </p>
        <div className="qr-frame">
          <QRCodeSVG
            value={value}
            marginSize={4}
            size={220}
            bgColor="#fffdf6"
            fgColor="#102b2a"
          />
        </div>
        <div className="qr-meta">
          <span>Secure QR payload</span>
          <span>Single use</span>
        </div>
        <button className="primary-button wide" onClick={onClose}>
          Done <Check size={16} />
        </button>
      </div>
    </div>
  );
}
