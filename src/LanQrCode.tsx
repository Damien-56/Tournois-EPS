import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function LanQrCode({ value }: { value: string }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 164, margin: 1, errorCorrectionLevel: "M", color: { dark: "#17324f", light: "#ffffff" } })
      .then((data) => { if (active) setImage(data); })
      .catch(() => { if (active) setImage(""); });
    return () => { active = false; };
  }, [value]);
  return image ? <img className="lan-qr" src={image} alt={`QR code pour rejoindre ${value}`} /> : <div className="lan-qr-placeholder">QR</div>;
}
