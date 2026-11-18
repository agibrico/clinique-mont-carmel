import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileImage,
  Navigation,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  buildNavigationUrl,
  DEFAULT_MAPS_URL,
  parseGoogleMapsInput,
  type TargetProvider,
  type TravelMode,
} from './utils/mapsParser';
import {
  downloadGithubRedirectHtml,
  downloadPosterPng,
  downloadSvgString,
  generateQrPngDataUrl,
  generateQrSvg,
  triggerFileDownload,
  type ErrorCorrectionLevel,
} from './utils/qrExport';

const COLOR_PRESETS = [
  { id: 'slate', label: 'Noir clinique', hex: '#0F172A' },
  { id: 'teal', label: 'Vert médical', hex: '#0F766E' },
  { id: 'navy', label: 'Bleu marine', hex: '#1E3A8A' },
  { id: 'zinc', label: 'Anthracite', hex: '#18181B' },
] as const;

const PROVIDER_OPTIONS: { id: TargetProvider; label: string }[] = [
  { id: 'google-dir', label: 'Itinéraire Google Maps' },
  { id: 'waze', label: 'Waze Navigation' },
  { id: 'apple-maps', label: 'Apple Plans' },
  { id: 'google-place', label: 'Position seule' },
];

const TRAVEL_MODES: { id: TravelMode; label: string }[] = [
  { id: 'auto', label: 'Libre' },
  { id: 'driving', label: 'Voiture' },
  { id: 'walking', label: 'À pied' },
  { id: 'transit', label: 'Transport' },
];

const CORRECTION_LEVELS: { id: ErrorCorrectionLevel; label: string }[] = [
  { id: 'M', label: 'M · 15%' },
  { id: 'Q', label: 'Q · 25%' },
  { id: 'H', label: 'H · 30%' },
];

const COORD_SOURCE_LABEL: Record<string, string> = {
  pin: 'Repère exact du lieu (!3d / !4d)',
  query: 'Paramètre de requête GPS',
  viewport: 'Centre de la carte (@)',
  manual: 'Coordonnées saisies',
  none: 'Non détectées',
};

export default function App() {
  const [rawInput, setRawInput] = useState<string>(DEFAULT_MAPS_URL);
  const parsed = useMemo(() => parseGoogleMapsInput(rawInput), [rawInput]);

  const [displayTitle, setDisplayTitle] = useState<string>('Clinique Mont Carmel');
  const [displaySubtitle, setDisplaySubtitle] = useState<string>(
    'Scannez pour démarrer l’itinéraire GPS'
  );
  const [provider, setProvider] = useState<TargetProvider>('google-dir');
  const [travelMode, setTravelMode] = useState<TravelMode>('auto');
  const [qrColor, setQrColor] = useState<string>('#0F172A');
  const [errorLevel, setErrorLevel] = useState<ErrorCorrectionLevel>('Q');
  const [encodingMode, setEncodingMode] = useState<'direct' | 'github'>('direct');
  const [githubPagesUrl, setGithubPagesUrl] = useState<string>('');

  const [qrSvg, setQrSvg] = useState<string>('');
  const [qrPngPreview, setQrPngPreview] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExportingPoster, setIsExportingPoster] = useState<boolean>(false);

  // Sync display title automatically when user pastes a different Google Maps link
  const handleInputChange = (nextValue: string) => {
    setRawInput(nextValue);
    const nextParsed = parseGoogleMapsInput(nextValue);
    if (nextParsed.isValid && nextParsed.placeName) {
      setDisplayTitle(nextParsed.placeName);
    }
  };

  const handleResetDefault = () => {
    setRawInput(DEFAULT_MAPS_URL);
    setDisplayTitle('Clinique Mont Carmel');
    setDisplaySubtitle('Scannez pour démarrer l’itinéraire GPS');
    setProvider('google-dir');
    setTravelMode('auto');
  };

  const handleClearInput = () => {
    setRawInput('');
  };

  const directRouteUrl = useMemo(() => {
    if (!parsed.isValid || parsed.lat === null || parsed.lng === null) {
      return '';
    }
    return buildNavigationUrl(parsed.lat, parsed.lng, provider, travelMode);
  }, [parsed, provider, travelMode]);

  const isGithubUrlValid = useMemo(() => {
    const trimmed = githubPagesUrl.trim();
    return /^https?:\/\/.+\..+/i.test(trimmed);
  }, [githubPagesUrl]);

  const targetUrl = useMemo(() => {
    if (encodingMode === 'github') {
      return isGithubUrlValid ? githubPagesUrl.trim() : '';
    }
    return directRouteUrl;
  }, [encodingMode, isGithubUrlValid, githubPagesUrl, directRouteUrl]);

  useEffect(() => {
    let active = true;
    if (!targetUrl) {
      setQrSvg('');
      setQrPngPreview('');
      return;
    }

    Promise.all([
      generateQrSvg({ url: targetUrl, colorDark: qrColor, errorCorrectionLevel: errorLevel }),
      generateQrPngDataUrl(
        { url: targetUrl, colorDark: qrColor, errorCorrectionLevel: errorLevel },
        1024
      ),
    ])
      .then(([svg, png]) => {
        if (!active) return;
        setQrSvg(svg);
        setQrPngPreview(png);
      })
      .catch(() => {
        if (!active) return;
        setQrSvg('');
        setQrPngPreview('');
      });

    return () => {
      active = false;
    };
  }, [targetUrl, qrColor, errorLevel]);

  const safeSlug = useMemo(() => {
    const base = (displayTitle || 'itineraire-gps')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'itineraire-gps';
  }, [displayTitle]);

  const coordsText =
    parsed.lat !== null && parsed.lng !== null
      ? `${parsed.lat.toFixed(7)}, ${parsed.lng.toFixed(7)}`
      : '—';

  const handleCopyLink = async () => {
    if (!targetUrl) return;
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleDownloadPng = async () => {
    if (!targetUrl) return;
    const pngUrl =
      qrPngPreview ||
      (await generateQrPngDataUrl(
        { url: targetUrl, colorDark: qrColor, errorCorrectionLevel: errorLevel },
        1024
      ));
    triggerFileDownload(pngUrl, `qr-itineraire-${safeSlug}.png`);
  };

  const handleDownloadSvg = () => {
    if (!qrSvg) return;
    downloadSvgString(qrSvg, `qr-itineraire-${safeSlug}.svg`);
  };

  const handleDownloadPoster = async () => {
    if (!targetUrl) return;
    setIsExportingPoster(true);
    try {
      await downloadPosterPng({
        url: targetUrl,
        title: displayTitle.trim() || 'Destination GPS',
        subtitle: displaySubtitle.trim() || 'Scannez pour démarrer l’itinéraire GPS',
        coordsLabel: coordsText,
        colorDark: qrColor,
        errorCorrectionLevel: errorLevel,
        filename: `affiche-itineraire-${safeSlug}.png`,
      });
    } finally {
      setIsExportingPoster(false);
    }
  };

  const handleDownloadGithubIndex = () => {
    if (!directRouteUrl) return;
    downloadGithubRedirectHtml({
      title: displayTitle.trim() || 'Clinique Mont Carmel',
      destinationUrl: directRouteUrl,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const supportsTravelMode = provider === 'google-dir' || provider === 'apple-maps';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar — 3-zone contract */}
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Itinéraire QR
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#source"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Lien Google Maps
            </a>
            <a
              href="#options"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Paramètres QR
            </a>
            <a
              href="#lien-genere"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Lien d’itinéraire
            </a>
            <a
              href="#apercu"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Aperçu & Export
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!targetUrl}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Télécharger PNG</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1200px] px-6 py-8 lg:py-10">
        {/* Intro Block */}
        <section className="no-print mb-8 border-b border-slate-200 pb-6">
          <h1
            className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
            style={{ textWrap: 'balance' }}
          >
            QR Code d’itinéraire GPS direct
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-800">
              {displayTitle || 'Destination Google Maps'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-xs sm:text-sm text-slate-600">
              {coordsText}
            </span>
            <span aria-hidden="true">·</span>
            <span>Scans illimités sans expiration</span>
          </div>
        </section>

        {/* Two-column Workspace */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Controls & Configuration */}
          <div className="no-print space-y-6 lg:col-span-7">
            {/* Section 1: Source Link & Extraction */}
            <section
              id="source"
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    1. Position Google Maps source
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Lien analysé automatiquement pour extraire les coordonnées exactes du lieu.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetDefault}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Mont Carmel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearInput}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-700 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Effacer</span>
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="maps-url-input" className="sr-only">
                  Lien Google Maps ou coordonnées GPS
                </label>
                <textarea
                  id="maps-url-input"
                  rows={3}
                  value={rawInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Collez un lien Google Maps complet ou des coordonnées (ex : 5.3552392, -4.0985352)"
                  className="font-mono-tabular w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none"
                />
              </div>

              {!parsed.isValid ? (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
                >
                  {parsed.errorMessage}
                </div>
              ) : (
                <dl className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Coordonnées extraites</dt>
                    <dd className="font-mono-tabular mt-1 text-sm font-semibold text-slate-900">
                      {coordsText}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Source de précision</dt>
                    <dd className="mt-1 text-sm text-slate-700">
                      {COORD_SOURCE_LABEL[parsed.coordSource]}
                    </dd>
                  </div>
                </dl>
              )}

              {/* Editable Title & Subtitle for printable card */}
              <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="display-title"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Nom affiché sur la fiche
                  </label>
                  <input
                    id="display-title"
                    type="text"
                    value={displayTitle}
                    onChange={(e) => setDisplayTitle(e.target.value)}
                    placeholder="Clinique Mont Carmel"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="display-subtitle"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Instruction sous le titre
                  </label>
                  <input
                    id="display-subtitle"
                    type="text"
                    value={displaySubtitle}
                    onChange={(e) => setDisplaySubtitle(e.target.value)}
                    placeholder="Scannez pour démarrer l’itinéraire GPS"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Section 2: QR Parameters */}
            <section
              id="options"
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
            >
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  2. Comportement au scan & Style
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Le lien universel Google Maps ouvre l’itinéraire depuis la position actuelle du visiteur.
                </p>
              </div>

              {/* Navigation Provider */}
              <div>
                <span className="block text-xs font-medium text-slate-700">
                  Application ouverte lors du scan
                </span>
                <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 sm:grid-cols-4">
                  {PROVIDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setProvider(opt.id)}
                      className={`rounded-md px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap truncate ${
                        provider === opt.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Travel Mode */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-medium text-slate-700">
                    Mode de transport par défaut
                  </span>
                  {!supportsTravelMode && (
                    <span className="text-xs text-slate-500">
                      Non applicable pour ce format
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 sm:grid-cols-4">
                  {TRAVEL_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      disabled={!supportsTravelMode}
                      onClick={() => setTravelMode(mode.id)}
                      className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${
                        travelMode === mode.id && supportsTravelMode
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color & Error Correction */}
              <div className="grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div>
                  <span className="block text-xs font-medium text-slate-700">
                    Couleur du QR code
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((preset) => {
                      const active = qrColor === preset.hex;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setQrColor(preset.hex)}
                          aria-label={preset.label}
                          title={preset.label}
                          className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className="h-3 w-3 rounded-xs border border-black/15"
                            style={{ backgroundColor: preset.hex }}
                            aria-hidden="true"
                          />
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-700">
                    Tolérance de lecture (impression)
                  </span>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg bg-slate-100 p-1">
                    {CORRECTION_LEVELS.map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setErrorLevel(lvl.id)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          errorLevel === lvl.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Generated Direct Route URL & Unlimited GitHub Pages Hosting */}
            <section
              id="lien-genere"
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  3. Scans illimités & Hébergement GitHub
                </h2>
                <span className="text-xs text-slate-500">
                  Code statique · Aucun quota · Sans expiration
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 rounded-lg bg-slate-100 p-1 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setEncodingMode('direct')}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    encodingMode === 'direct'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lien direct Google Maps (illimité)
                </button>
                <button
                  type="button"
                  onClick={() => setEncodingMode('github')}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    encodingMode === 'github'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Page GitHub Pages (illimité & modifiable)
                </button>
              </div>

              {encodingMode === 'direct' ? (
                <p className="text-sm leading-relaxed text-slate-600">
                  Le QR code encode directement l’URL Google Maps sans intermédiaire payant. Il reste scannable de façon illimitée à vie, sans serveur ni abonnement.
                </p>
              ) : (
                <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs leading-relaxed text-slate-600">
                    Hébergez un fichier <span className="font-mono-tabular font-semibold text-slate-800">index.html</span> de redirection sur GitHub Pages pour obtenir des scans illimités tout en pouvant modifier l’adresse GPS plus tard sur GitHub sans réimprimer votre QR code.
                  </p>

                  <div>
                    <label
                      htmlFor="github-pages-url"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Votre URL GitHub Pages (ex : https://utilisateur.github.io/clinique-mont-carmel/)
                    </label>
                    <input
                      id="github-pages-url"
                      type="url"
                      value={githubPagesUrl}
                      onChange={(e) => setGithubPagesUrl(e.target.value)}
                      placeholder="https://utilisateur.github.io/clinique-mont-carmel/"
                      className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadGithubIndex}
                      disabled={!directRouteUrl}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                    >
                      <FileCode2 className="h-4 w-4 text-teal-700" aria-hidden="true" />
                      <span>Télécharger index.html pour GitHub</span>
                    </button>
                    <span className="text-xs text-slate-500">
                      Dépôt prêt avec workflow GitHub Actions inclus
                    </span>
                  </div>
                </div>
              )}

              <div>
                <span className="block text-xs font-medium text-slate-500">
                  URL exacte encodée dans le QR code
                </span>
                <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <p className="font-mono-tabular break-all text-xs leading-relaxed text-slate-800">
                    {targetUrl ||
                      (encodingMode === 'github'
                        ? 'Saisissez votre URL GitHub Pages ci-dessus pour générer le QR code…'
                        : 'En attente de coordonnées valides…')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!targetUrl}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-teal-700" aria-hidden="true" />
                      <span>Lien copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span>Copier le lien</span>
                    </>
                  )}
                </button>

                {directRouteUrl ? (
                  <a
                    href={directRouteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap"
                  >
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                    <span>Tester l’itinéraire</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500 whitespace-nowrap">
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                    <span>Tester l’itinéraire</span>
                  </span>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Printable QR Card & Export Actions */}
          <aside id="apercu" className="space-y-4 lg:col-span-5 lg:sticky lg:top-6">
            {/* Printable Signage Card */}
            <div className="print-only-card overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div
                className="h-2 w-full"
                style={{ backgroundColor: qrColor }}
                aria-hidden="true"
              />

              <div className="p-7 sm:p-8 text-center">
                <p
                  className="font-display text-sm font-semibold"
                  style={{ color: qrColor }}
                >
                  Itinéraire GPS direct
                </p>

                <h2
                  className="font-display mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
                  style={{ textWrap: 'balance' }}
                >
                  {displayTitle.trim() || 'Destination GPS'}
                </h2>

                <p className="mt-1.5 text-sm text-slate-600">
                  {displaySubtitle.trim() || 'Scannez pour démarrer l’itinéraire GPS'}
                </p>

                {/* QR Render Area */}
                <div className="mt-6 flex justify-center">
                  {qrSvg ? (
                    <div
                      className="w-60 h-60 sm:w-64 sm:h-64 rounded-lg border border-slate-200 bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
                      aria-label={`QR code d'itinéraire vers ${displayTitle}`}
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  ) : (
                    <div className="flex h-60 w-60 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500 sm:h-64 sm:w-64">
                      Saisissez un lien Google Maps valide pour générer le QR code.
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <p className="text-xs font-medium text-slate-700">
                    Ouvrez l’appareil photo de votre téléphone et visez le code
                  </p>
                  <p className="font-mono-tabular mt-1.5 text-xs text-slate-500">
                    GPS : {coordsText}
                  </p>
                </div>
              </div>
            </div>

            {/* Export Action Buttons */}
            <div className="no-print rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-medium text-slate-500">
                Télécharger ou imprimer
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={!targetUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>QR seul (PNG)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  disabled={!qrSvg}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Vectoriel (SVG)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPoster}
                  disabled={!targetUrl || isExportingPoster}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                >
                  <FileImage className="h-4 w-4" aria-hidden="true" />
                  <span>{isExportingPoster ? 'Création…' : 'Affichette (PNG)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!targetUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  <span>Imprimer la fiche</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
