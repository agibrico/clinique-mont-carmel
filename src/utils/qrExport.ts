import QRCode from 'qrcode';

export type ErrorCorrectionLevel = 'M' | 'Q' | 'H';

export interface QrRenderOptions {
  url: string;
  colorDark: string;
  errorCorrectionLevel: ErrorCorrectionLevel;
}

export async function generateQrSvg(options: QrRenderOptions): Promise<string> {
  return QRCode.toString(options.url, {
    type: 'svg',
    errorCorrectionLevel: options.errorCorrectionLevel,
    margin: 2,
    color: {
      dark: options.colorDark,
      light: '#FFFFFF',
    },
  });
}

export async function generateQrPngDataUrl(options: QrRenderOptions, width = 1024): Promise<string> {
  return QRCode.toDataURL(options.url, {
    type: 'image/png',
    width,
    margin: 2,
    errorCorrectionLevel: options.errorCorrectionLevel,
    color: {
      dark: options.colorDark,
      light: '#FFFFFF',
    },
  });
}

export function triggerFileDownload(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadSvgString(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerFileDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPosterPng(params: {
  url: string;
  title: string;
  subtitle: string;
  coordsLabel: string;
  colorDark: string;
  errorCorrectionLevel: ErrorCorrectionLevel;
  filename: string;
}): Promise<void> {
  const width = 1080;
  const height = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clean white paper canvas
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Subtle outer frame
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, width - 96, height - 96);

  // Top accent bar (subtle hairline rule, clean design)
  ctx.fillStyle = params.colorDark;
  ctx.fillRect(48, 48, width - 96, 14);

  // Header kicker
  ctx.fillStyle = params.colorDark;
  ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Itinéraire GPS direct', width / 2, 168);

  // Place Title (word-wrapped if long)
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 50px "Plus Jakarta Sans", sans-serif';
  const words = params.title.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > 860 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);

  let titleY = 250;
  for (const line of lines.slice(0, 2)) {
    ctx.fillText(line, width / 2, titleY);
    titleY += 64;
  }

  // Subtitle
  ctx.fillStyle = '#475569';
  ctx.font = '400 30px "Public Sans", sans-serif';
  ctx.fillText(params.subtitle, width / 2, titleY + 18);

  // QR code crisp bitmap
  const qrDataUrl = await generateQrPngDataUrl(
    {
      url: params.url,
      colorDark: params.colorDark,
      errorCorrectionLevel: params.errorCorrectionLevel,
    },
    720
  );

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('QR image load error'));
    img.src = qrDataUrl;
  });

  const qrSize = 700;
  const qrX = (width - qrSize) / 2;
  const qrY = titleY + 86;

  // Crisp QR container border
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  ctx.strokeRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48);
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  // Coordinates & instructions footer
  const footerY = qrY + qrSize + 96;
  ctx.fillStyle = '#0F172A';
  ctx.font = '600 28px "Public Sans", sans-serif';
  ctx.fillText('Ouvrez l’appareil photo de votre téléphone et scannez ce code', width / 2, footerY);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 24px "JetBrains Mono", monospace';
  ctx.fillText(`GPS : ${params.coordsLabel}`, width / 2, footerY + 52);

  const pngUrl = canvas.toDataURL('image/png');
  triggerFileDownload(pngUrl, params.filename);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function downloadGithubRedirectHtml(params: {
  title: string;
  destinationUrl: string;
}): void {
  const safeTitle = escapeHtml(params.title || 'Itinéraire GPS');
  const safeUrl = escapeHtml(params.destinationUrl);
  const jsUrl = JSON.stringify(params.destinationUrl);

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Itinéraire — ${safeTitle}</title>
    <meta http-equiv="refresh" content="0; url=${safeUrl}" />
    <script>
      window.location.replace(${jsUrl});
    </script>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      .card {
        max-width: 420px;
        width: 100%;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 28px;
        text-align: center;
      }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.5; }
      a {
        display: inline-block;
        background: #0f766e;
        color: #ffffff;
        text-decoration: none;
        font-weight: 600;
        font-size: 14px;
        padding: 12px 20px;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${safeTitle}</h1>
      <p>Ouverture de l’itinéraire GPS dans Google Maps…</p>
      <a href="${safeUrl}">Ouvrir l’itinéraire</a>
    </main>
  </body>
</html>
`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerFileDownload(url, 'index.html');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

