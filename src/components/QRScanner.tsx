import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QRScannerProps {
  /** Called when a QR code is successfully decoded. Receives the raw payload. */
  onScan: (payload: string) => void;
  /** Called when the user closes the scanner. */
  onClose: () => void;
  /** How long to wait after a successful scan before accepting the next one (ms). */
  debounceMs?: number;
}

/**
 * Live camera QR scanner.
 *
 * Implementation notes:
 *  - We attach the rear camera to a <video> and continuously paint frames
 *    onto an offscreen <canvas>, then run jsQR over the canvas pixels.
 *  - jsQR is pure JS (no WASM, no native APIs), so it works on every browser
 *    that supports getUserMedia. It's slower than the native BarcodeDetector
 *    but ubiquitous; we could swap in BarcodeDetector behind a feature check
 *    later for a speed-up on Chrome/Android.
 *  - We debounce repeated decodes of the same payload — without this, holding
 *    the camera steady on a QR for half a second would fire the callback
 *    20+ times.
 *  - We downsample the canvas to ~480px wide for speed. The scanner happily
 *    decodes QR codes at this resolution from ~30cm away.
 */
export function QRScanner({ onScan, onClose, debounceMs = 2000 }: QRScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Track last successful scan so we can debounce. We compare on payload —
  // a different QR code held up immediately should still fire instantly.
  const lastScanRef = useRef<{ payload: string; at: number } | null>(null);

  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // The scan loop is a closure over onScan; we keep it in a ref so we can
  // update it on rerenders without restarting the camera.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('scanning');
        tick();
      } catch (e) {
        const message =
          e instanceof Error
            ? e.name === 'NotAllowedError'
              ? t('dash.scanner.errDenied', { defaultValue: 'Camera permission denied. Allow access in your browser settings.' })
              : e.name === 'NotFoundError'
                ? t('dash.scanner.errNoCamera', { defaultValue: 'No camera found on this device.' })
                : e.message
            : t('dash.scanner.errGeneric', { defaultValue: 'Could not access the camera' });
        setErrorMsg(message);
        setStatus('error');
      }
    };

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Downsample for speed. 480 wide is plenty for QR decoding.
      const targetW = 480;
      const scale = targetW / video.videoWidth;
      const targetH = Math.round(video.videoHeight * scale);
      if (canvas.width !== targetW) canvas.width = targetW;
      if (canvas.height !== targetH) canvas.height = targetH;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      ctx.drawImage(video, 0, 0, targetW, targetH);
      const imageData = ctx.getImageData(0, 0, targetW, targetH);

      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert', // ~4x faster; standard QR is dark-on-light
      });

      if (code?.data) {
        const now = Date.now();
        const last = lastScanRef.current;
        const isRecent = last && last.payload === code.data && now - last.at < debounceMs;
        if (!isRecent) {
          lastScanRef.current = { payload: code.data, at: now };
          onScanRef.current(code.data);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    start();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [debounceMs]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden flex flex-col">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      {/* Hidden working canvas — kept in the DOM so React keeps the ref alive. */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        <div className="w-64 h-64 relative">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
        </div>
        <div className="mt-8 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-medium">
          {status === 'starting' && t('dash.scanner.starting', { defaultValue: 'Starting camera…' })}
          {status === 'scanning' && t('dash.scanner.point', { defaultValue: 'Point at a customer QR code' })}
          {status === 'error' && t('dash.scanner.unavailable', { defaultValue: 'Camera unavailable' })}
        </div>
      </div>

      {/* Error overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 text-center">
          <Camera className="w-12 h-12 mb-4 text-red-400" />
          <p className="text-sm max-w-xs">{errorMsg}</p>
          <button
            onClick={onClose}
            className="mt-6 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md text-sm transition"
          >
            {t('dash.scanner.close', { defaultValue: 'Close' })}
          </button>
        </div>
      )}

      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition z-10"
        aria-label={t('dash.scanner.closeScanner', { defaultValue: 'Close scanner' })}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * Parses a card QR payload. Recognises three formats:
 *
 *  1. Signed stamp token: `<base64url-payload>.<base64url-signature>`
 *     Generated by the issue-stamp-token Edge Function. Short-lived (60s),
 *     replay-protected. This is what the modern customer wallet view emits.
 *
 *  2. JSON envelope: `{"cardId": "<uuid>"}`
 *     Older customer wallet emits this. Also embedded in Google Wallet
 *     passes that were saved before token rotation existed.
 *
 *  3. Bare UUID
 *     Pure forward-compat path; never emitted by our UI today.
 *
 * Returns null for anything we don't recognise.
 */
export function parseCardQRPayload(
  payload: string,
): { kind: 'token'; token: string } | { kind: 'cardId'; cardId: string } | null {
  const trimmed = payload.trim();

  // 1) Signed token: two non-empty base64url segments separated by a dot,
  //    each at least ~10 chars. (Real signatures are 43 chars; payloads
  //    are typically 50-150.)
  const tokenMatch = /^([A-Za-z0-9_-]{10,})\.([A-Za-z0-9_-]{20,})$/;
  if (tokenMatch.test(trimmed)) {
    return { kind: 'token', token: trimmed };
  }

  // 2) JSON envelope
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.cardId === 'string' && parsed.cardId.length > 0) {
        return { kind: 'cardId', cardId: parsed.cardId };
      }
    } catch {
      /* fall through */
    }
  }

  // 3) Bare UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return { kind: 'cardId', cardId: trimmed };
  }

  return null;
}
