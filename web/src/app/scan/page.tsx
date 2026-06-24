'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ScanBarcode, CameraOff, Keyboard, Loader2, WifiOff, History, ExternalLink } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { ResaleEstimate } from '@shopping-assistant/types';
import PageShell from '@/components/ui/PageShell';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro } from '@/lib/format';
import { readQueue, writeQueue, enqueue } from '@/lib/offlineQueue';

const QUEUE_KEY = 'brocante';
const HISTORY_KEY = 'sa-brocante-history';
const MARGINS = [20, 30, 50];

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
}

interface HistoryEntry {
  term: string;
  median: number | null;
  sampleCount: number;
  ts: number;
}

interface Verdict {
  label: string;
  cls: string;
  sub: string;
}

function computeVerdict(r: ResaleEstimate | null, targetMargin: number, asking: number | null): Verdict {
  if (!r || !r.sampleCount || r.median == null || r.netEstimate == null) {
    return { label: 'PAS DE DONNÉES', cls: 'bg-slate-500/15 text-slate-300', sub: 'Aucune vente récente trouvée' };
  }
  const maxBuy = r.netEstimate / (1 + targetMargin / 100);
  if (asking != null && asking > 0) {
    if (asking <= maxBuy && r.confidenceLabel !== 'faible')
      return { label: 'ACHÈTE', cls: 'bg-emerald-500/20 text-emerald-300', sub: `Prix demandé sous ton max (${euro(maxBuy)})` };
    if (asking <= maxBuy)
      return { label: 'PRUDENCE', cls: 'bg-amber-500/20 text-amber-300', sub: 'Sous le max mais peu de données fiables' };
    return { label: 'PASSE', cls: 'bg-rose-500/20 text-rose-300', sub: `Trop cher — max conseillé ${euro(maxBuy)}` };
  }
  if (r.confidenceLabel === 'faible')
    return { label: 'PRUDENCE', cls: 'bg-amber-500/20 text-amber-300', sub: 'Peu de données fiables' };
  return { label: 'BON FLIP POSSIBLE', cls: 'bg-emerald-500/20 text-emerald-300', sub: `Achète jusqu'à ${euro(maxBuy)}` };
}

function readHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]') as HistoryEntry[];
  } catch {
    return [];
  }
}

export default function ScanPage() {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [manual, setManual] = useState('');
  const [asking, setAsking] = useState('');
  const [targetMargin, setTargetMargin] = useState(30);
  const [loading, setLoading] = useState(false);
  const [estError, setEstError] = useState<string | null>(null);
  const [result, setResult] = useState<ResaleEstimate | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const pushHistory = useCallback((t: string, data: ResaleEstimate) => {
    const entry: HistoryEntry = { term: t, median: data.median ?? null, sampleCount: data.sampleCount, ts: Date.now() };
    setHistory((prev) => {
      const next = [entry, ...prev.filter((e) => e.term !== t)].slice(0, 12);
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const analyze = useCallback(
    async (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      setEstError(null);
      setResult(null);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setQueue(enqueue(QUEUE_KEY, t));
        toast.info('Hors-ligne : ajouté à la file');
        return;
      }
      setLoading(true);
      try {
        const data = await apiFetch<ResaleEstimate>('/estimate', {
          method: 'POST',
          json: { query: t, platform: 'ebay' },
        });
        setResult(data);
        pushHistory(t, data);
      } catch {
        setQueue(enqueue(QUEUE_KEY, t));
        setEstError('Estimation indisponible — mise en file (réessai au retour du réseau).');
      } finally {
        setLoading(false);
      }
    },
    [pushHistory]
  );

  const processQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    let pending = readQueue(QUEUE_KEY);
    for (const t of [...pending]) {
      try {
        const data = await apiFetch<ResaleEstimate>('/estimate', {
          method: 'POST',
          json: { query: t, platform: 'ebay' },
        });
        pushHistory(t, data);
        pending = pending.filter((x) => x !== t);
        writeQueue(QUEUE_KEY, pending);
        setQueue(pending);
      } catch {
        break; // on garde le reste pour un prochain essai
      }
    }
  }, [pushHistory]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window);
    setQueue(readQueue(QUEUE_KEY));
    setHistory(readHistory());
    if (typeof navigator !== 'undefined' && navigator.onLine) processQueue();
    const onOnline = () => {
      toast.info('Connexion retrouvée — traitement de la file');
      processQueue();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      stop();
    };
  }, [processQueue, stop]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);

      const DetectorClass = (window as unknown as { BarcodeDetector: BarcodeDetectorConstructor }).BarcodeDetector;
      const detector = new DetectorClass({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });

      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const ean = codes[0].rawValue;
            stop();
            analyze(ean);
            return;
          }
        } catch {
          /* frame non décodable */
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      setCameraError("Impossible d'accéder à la caméra. Autorisez l'accès, ou saisissez le code/nom à la main.");
      stop();
    }
  };

  const askingNum = asking ? Number(asking) : null;
  const validAsking = askingNum != null && Number.isFinite(askingNum) && askingNum > 0 ? askingNum : null;
  const maxBuy = result?.netEstimate != null ? result.netEstimate / (1 + targetMargin / 100) : null;
  const verdict = computeVerdict(result, targetMargin, validAsking);

  return (
    <PageShell
      title={t('page.scan.title', 'Mode brocante')}
      icon={<ScanBarcode className="h-6 w-6" />}
      subtitle={t('page.scan.sub', "Scanne ou saisis un objet : verdict immédiat et prix d'achat max pour ta marge cible")}
    >
      <div className="mx-auto max-w-md space-y-4">
        {queue.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            <WifiOff className="h-4 w-4" />
            {queue.length} en attente (réseau) — traité automatiquement au retour.
          </div>
        )}

        {/* Reglages */}
        <div className="card-pad grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-400">
            Marge cible
            <select
              value={targetMargin}
              onChange={(e) => setTargetMargin(Number(e.target.value))}
              className="input mt-1 w-full"
            >
              {MARGINS.map((m) => (
                <option key={m} value={m}>
                  {m} %
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Prix demandé (optionnel)
            <input
              type="number"
              value={asking}
              onChange={(e) => setAsking(e.target.value)}
              placeholder="€ sur l'étiquette"
              className="input mt-1 w-full"
              min="0"
              step="0.5"
              inputMode="decimal"
            />
          </label>
        </div>

        {/* Camera */}
        {cameraError && <ErrorBanner message={cameraError} />}
        {supported && (
          <div className="card overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              className={`aspect-[4/3] w-full bg-ink object-cover ${scanning ? '' : 'hidden'}`}
              playsInline
              muted
            />
            {!scanning && (
              <div className="flex aspect-[4/3] items-center justify-center">
                <button onClick={startCamera} className="btn-primary">
                  <ScanBarcode className="h-4 w-4" /> Scanner un code-barres
                </button>
              </div>
            )}
            {scanning && (
              <div className="border-t border-line p-3 text-center">
                <p className="text-xs text-slate-400">Visez le code-barres… détection automatique.</p>
                <button onClick={stop} className="btn-secondary mt-2 text-xs">
                  Arrêter
                </button>
              </div>
            )}
          </div>
        )}
        {supported === false && (
          <div className="card-pad text-center text-sm text-slate-400">
            <CameraOff className="mx-auto mb-2 h-7 w-7 text-slate-500" />
            Scanner non supporté par ce navigateur (Chrome Android requis). Utilisez la saisie ci-dessous.
          </div>
        )}

        {/* Saisie manuelle */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            analyze(manual);
          }}
          className="card-pad"
        >
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Keyboard className="h-4 w-4" /> Saisie manuelle
          </p>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="EAN ou nom de l'objet"
              className="input flex-1"
            />
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Estimer'}
            </button>
          </div>
        </form>

        {estError && <ErrorBanner message={estError} />}

        {loading && (
          <div className="card flex items-center justify-center gap-3 px-6 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-accent" /> Analyse des ventes eBay… (~20 s)
          </div>
        )}

        {/* Verdict */}
        {!loading && result && (
          <div className="card-pad space-y-3">
            <div className="truncate text-xs text-slate-500">
              {result.barcode ? `Code ${result.barcode} → ` : ''}
              {result.query}
            </div>
            <div className={`rounded-xl px-4 py-3 text-center ${verdict.cls}`}>
              <div className="text-2xl font-extrabold tracking-tight">{verdict.label}</div>
              <div className="mt-0.5 text-xs opacity-80">{verdict.sub}</div>
            </div>
            {maxBuy != null && (
              <div className="flex items-center justify-between rounded-lg border border-line bg-ink/40 px-4 py-3">
                <span className="text-sm text-slate-400">Prix d&apos;achat max</span>
                <span className="text-2xl font-bold text-accent">{euro(maxBuy)}</span>
              </div>
            )}
            {result.sampleCount > 0 && result.median != null && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span>Revente ~{euro(result.median)}</span>
                <span>· net {euro(result.netEstimate ?? 0)}</span>
                <span>· {result.sampleCount} ventes</span>
                {result.velocityLabel && <span>· se vend {result.velocityLabel}</span>}
                {result.confidenceLabel && <span>· fiabilité {result.confidenceLabel}</span>}
              </div>
            )}
          </div>
        )}

        {/* Historique */}
        {history.length > 0 && (
          <div className="card-pad">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <History className="h-4 w-4" /> Récents
            </p>
            <div className="space-y-0.5">
              {history.map((h) => (
                <button
                  key={`${h.term}-${h.ts}`}
                  type="button"
                  onClick={() => analyze(h.term)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[rgb(var(--overlay)/0.05)]"
                >
                  <span className="truncate text-slate-300">{h.term}</span>
                  <span className="shrink-0 text-slate-400">
                    {h.median != null ? euro(h.median) : '—'}
                    <ExternalLink className="ml-1 inline h-3 w-3 text-slate-600" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
