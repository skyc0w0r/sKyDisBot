import { createCanvas, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';
import { join } from 'path';
import Logger from 'log4js';

const logger = Logger.getLogger('blacklist_canvas');

export interface BlacklistEntry {
    username: string;
    reason: string;
    expired: boolean;
}

const MIN_WIDTH = 700;
const MAX_WIDTH = 1200;
const SIDE_MARGIN = 40;
const HEADER_HEIGHT = 130;
const ROW_HEIGHT = 70;

try {
    GlobalFonts.registerFromPath(join(process.cwd(), 'assets', 'fonts', 'PermanentMarker-Regular.ttf'), 'Blacklist Title');
    GlobalFonts.registerFromPath(join(process.cwd(), 'assets', 'fonts', 'Caveat-Regular.ttf'), 'Blacklist Body');
} catch (e) {
    logger.warn('Failed to register blacklist fonts, falling back to default font', e);
}

const measurer = createCanvas(1, 1).getContext('2d');
function measureWidth(font: string, text: string): number {
    measurer.font = font;
    return measurer.measureText(text).width;
}

// Trims text with a trailing "…" until it fits maxWidth, so one very long
// reason can't blow up the image width or get cut off the canvas edge.
function truncateToFit(font: string, text: string, maxWidth: number): string {
    if (measureWidth(font, text) <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && measureWidth(font, truncated + '…') > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
}

// Roughs up whatever is drawn on a transparent layer so it looks like worn
// chalk: dense grain confined to the drawn pixels, soft dust smears, and
// broken/eroded edges.
function applyChalkTexture(lctx: SKRSContext2D, w: number, h: number, scale: number): void {
    lctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < w * h * 0.18; i++) {
        lctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)';
        lctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }

    for (let i = 0; i < 10; i++) {
        lctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.15})`;
        lctx.beginPath();
        lctx.arc(Math.random() * w, Math.random() * h, scale * (0.2 + Math.random() * 0.3), 0, Math.PI * 2);
        lctx.fill();
    }

    lctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < w * h * 0.035; i++) {
        lctx.fillStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.5})`;
        lctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    for (let i = 0; i < 6; i++) {
        lctx.fillStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.4})`;
        lctx.fillRect(Math.random() * w, Math.random() * h, scale * (0.3 + Math.random() * 0.5), 1.5);
    }
}

// Draws text onto its own transparent canvas, roughs up its edges to look
// like worn chalk, then stamps it onto the main canvas at a slight random
// tilt/size so repeated lines don't look machine-printed.
function drawChalkText(ctx: SKRSContext2D, text: string, x: number, y: number, font: string, fontSize: number, color: string): void {
    const padding = fontSize;
    const textWidth = measureWidth(font, text);

    const w = textWidth + padding * 2;
    const h = fontSize * 1.6 + padding * 2;

    const layer = createCanvas(w, h);
    const lctx = layer.getContext('2d');
    lctx.font = font;
    lctx.fillStyle = color;
    lctx.textBaseline = 'alphabetic';
    lctx.fillText(text, padding, padding + fontSize);

    applyChalkTexture(lctx, w, h, fontSize);

    const tilt = (Math.random() - 0.5) * 0.08;
    ctx.save();
    ctx.translate(x, y + fontSize);
    ctx.rotate(tilt);
    ctx.drawImage(layer, -padding, -padding - fontSize);
    ctx.restore();
}

// Draws a single chalk strikethrough line spanning [x1, x2] at height y,
// used to mark an entire blacklist entry (number + text) as one unit.
function drawChalkStrike(ctx: SKRSContext2D, x1: number, x2: number, y: number, thickness: number, color: string): void {
    const padding = thickness * 4;
    const w = (x2 - x1) + padding * 2;
    const h = padding * 2;

    const layer = createCanvas(w, h);
    const lctx = layer.getContext('2d');
    lctx.strokeStyle = color;
    lctx.lineWidth = thickness;
    lctx.beginPath();
    lctx.moveTo(padding, h / 2);
    lctx.lineTo(w - padding, h / 2 + (Math.random() - 0.5) * thickness * 2);
    lctx.stroke();

    applyChalkTexture(lctx, w, h, thickness);

    ctx.drawImage(layer, x1 - padding, y - h / 2);
}

function grungeBackground(ctx: SKRSContext2D, width: number, height: number): void {
    // near-black brown base, like worn stained leather/chalkboard
    ctx.fillStyle = '#140d08';
    ctx.fillRect(0, 0, width, height);

    // soft mottled blotches blended on top, not sharp grain
    const blotchColors = ['#4a3426', '#2a1c12', '#5a3e28', '#1a110b'];
    for (let i = 0; i < 16; i++) {
        const cx = Math.random() * width;
        const cy = Math.random() * height;
        const r = 80 + Math.random() * 220;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, blotchColors[Math.floor(Math.random() * blotchColors.length)]);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.35 + Math.random() * 0.25;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // fine paper/photo grain
    for (let i = 0; i < (width * height) / 20; i++) {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.12})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
    }

    // long faint vertical scratches
    for (let i = 0; i < 25; i++) {
        const sx = Math.random() * width;
        ctx.strokeStyle = `rgba(0, 0, 0, ${0.1 + Math.random() * 0.2})`;
        ctx.lineWidth = 0.5 + Math.random();
        ctx.beginPath();
        ctx.moveTo(sx, Math.random() * height * 0.3);
        ctx.lineTo(sx + (Math.random() - 0.5) * 20, height * (0.6 + Math.random() * 0.4));
        ctx.stroke();
    }

    // darken the edges
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.max(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
}

export async function RenderBlacklist(entries: BlacklistEntry[]): Promise<Buffer> {
    const titleFontSize = 48;
    const titleFont = `bold ${titleFontSize}px "Blacklist Title"`;
    const titleWidth = measureWidth(titleFont, 'BLACKLIST');

    // first pass: work out each row's layout and how wide the canvas needs to be
    const maxBodyWidth = MAX_WIDTH - SIDE_MARGIN * 2;
    const rows = entries.map((entry, i) => {
        const bodyFontSize = 36 + Math.random() * 8;
        const numberFontSize = bodyFontSize * 1.2;
        const gap = bodyFontSize * 0.4;

        const numberText = `${i + 1}`;
        const numberFont = `${numberFontSize}px "Blacklist Title"`;
        const bodyFont = `${bodyFontSize}px "Blacklist Body"`;
        const numberWidth = measureWidth(numberFont, numberText);

        let bodyText = `${entry.username} — ${entry.reason}`;
        bodyText = truncateToFit(bodyFont, bodyText, maxBodyWidth - numberWidth - gap);
        const bodyWidth = measureWidth(bodyFont, bodyText);

        return { entry, numberText, numberFont, numberFontSize, bodyText, bodyFont, bodyFontSize, gap, numberWidth, bodyWidth };
    });

    const longestLine = Math.max(titleWidth, ...rows.map((r) => r.numberWidth + r.gap + r.bodyWidth));
    const canvasWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longestLine + SIDE_MARGIN * 2));

    const height = HEADER_HEIGHT + entries.length * ROW_HEIGHT;
    const canvas = createCanvas(canvasWidth, height);
    const ctx = canvas.getContext('2d');

    grungeBackground(ctx, canvasWidth, height);

    drawChalkText(ctx, 'BLACKLIST', (canvasWidth - titleWidth) / 2, 20, titleFont, titleFontSize, '#e8dcc8');

    rows.forEach((row, i) => {
        const y = HEADER_HEIGHT + i * ROW_HEIGHT;
        const totalWidth = row.numberWidth + row.gap + row.bodyWidth;
        const jitter = (Math.random() - 0.5) * 40;
        const startX = (canvasWidth - totalWidth) / 2 + jitter;

        // keep both pieces on the same baseline despite the different font sizes
        const baselineY = y + row.bodyFontSize;
        drawChalkText(ctx, row.numberText, startX, baselineY - row.numberFontSize, row.numberFont, row.numberFontSize, '#e8dcc8');
        drawChalkText(ctx, row.bodyText, startX + row.numberWidth + row.gap, y, row.bodyFont, row.bodyFontSize, '#e8dcc8');

        if (row.entry.expired) {
            drawChalkStrike(ctx, startX, startX + totalWidth, baselineY - row.bodyFontSize * 0.35, row.bodyFontSize * 0.1, '#e8dcc8');
        }
    });

    return canvas.encode('png');
}
