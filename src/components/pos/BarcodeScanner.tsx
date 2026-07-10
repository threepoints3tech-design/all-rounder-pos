import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import * as ZXing from "@zxing/library";
import type { Result } from "@zxing/library";
const { DecodeHintType, BarcodeFormat } = ZXing;
import { X, Camera, RefreshCw } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
};

// Restrict to common retail 1D barcodes + QR for much faster decoding
const HINTS = new Map<number, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const firedRef = useRef(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Enumerate cameras when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    firedRef.current = false;
    (async () => {
      setError(null);
      setReady(false);
      try {
        // Ask for permission first so device labels populate
        const tmp = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        tmp.getTracks().forEach((t) => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === "videoinput");
        if (cancelled) return;
        setDevices(cams);
        const back = cams.find((c) => /back|rear|environment/i.test(c.label));
        setDeviceId((prev) => prev ?? back?.deviceId ?? cams[0]?.deviceId);
      } catch (e) {
        if (cancelled) return;
        setError(
          "Camera သုံးခွင့် မရသေးပါ။ Browser မှာ camera permission ဖွင့်ပေးပါ။",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Start decoding when we have a chosen device
  useEffect(() => {
    if (!open || !videoRef.current) return;

    // Faster: hinted reader + shorter delay between decode attempts
    const reader = new BrowserMultiFormatReader(HINTS, {
      delayBetweenScanAttempts: 80,
      delayBetweenScanSuccess: 80,
    });
    let stopped = false;

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        // @ts-expect-error non-standard but widely supported
        focusMode: "continuous",
        deviceId: deviceId ? { exact: deviceId } : undefined,
      },
    };

    reader
      .decodeFromConstraints(
        constraints,
        videoRef.current,
        (result: Result | undefined, _err, controls) => {
          if (stopped) return;
          if (!controlsRef.current) controlsRef.current = controls;
          setReady(true);
          if (result && !firedRef.current) {
            firedRef.current = true;
            const code = result.getText();
            try {
              controls.stop();
            } catch {
              /* ignore */
            }
            controlsRef.current = null;
            // Small haptic feedback if available
            try {
              (navigator as Navigator & { vibrate?: (p: number) => void }).vibrate?.(60);
            } catch {
              /* ignore */
            }
            onDetected(code);
          }
        },
      )
      .catch((e) => {
        setError(String(e?.message ?? e));
      });

    return () => {
      stopped = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, deviceId, onDetected]);

  if (!open) return null;

  const switchCam = () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    controlsRef.current?.stop();
    controlsRef.current = null;
    setDeviceId(next.deviceId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Camera className="h-4 w-4 text-primary" /> Barcode ဖတ်ရန်
          </div>
          <div className="flex items-center gap-1">
            {devices.length > 1 && (
              <button
                onClick={switchCam}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary hover:bg-accent"
                aria-label="Switch camera"
                title="Switch camera"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary hover:bg-accent"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
          />
          {/* framing overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1/2 w-4/5 rounded-2xl border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
              Camera ဖွင့်နေသည်...
            </div>
          )}
        </div>

        {error && (
          <div className="border-t border-border bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        )}
        <div className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
          Barcode ကို frame ထဲ ချိန်ပေးပါ။ ဖတ်ပြီးလျှင် အလိုအလျောက် ပိတ်သွားမည်။
        </div>
      </div>
    </div>
  );
}
