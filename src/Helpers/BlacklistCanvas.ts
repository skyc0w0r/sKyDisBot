import { createCanvas, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';

export interface BlacklistEntry {
    username: string;
    reason: string;
    expired: boolean;
}

const WIDTH = 700;
const HEADER_HEIGHT = 130;
const ROW_HEIGHT = 60;

GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeprb.ttf', 'Blacklist Title');
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoepr.ttf', 'Blacklist Body');

// Draws text onto its own transparent canvas, roughs up its edges to look
// like worn chalk, then stamps it onto the main canvas at a slight random
// tilt/size so repeated lines don't look machine-printed.
function drawChalkText(ctx: SKRSContext2D, text: string, x: number, y: number, font: string, fontSize: number, color: string, strikethrough = false): void {
    const padding = fontSize;

    const measurer = createCanvas(1, 1).getContext('2d');
    measurer.font = font;
    const textWidth = measurer.measureText(text).width;

    const w = textWidth + padding * 2;
    const h = fontSize * 1.6 + padding * 2;

    const layer = createCanvas(w, h);
    const lctx = layer.getContext('2d');
    lctx.font = font;
    lctx.fillStyle = color;
    lctx.textBaseline = 'alphabetic';
    lctx.fillText(text, padding, padding + fontSize);

    if (strikethrough) {
        lctx.strokeStyle = color;
        lctx.lineWidth = fontSize * 0.1;
        lctx.beginPath();
        lctx.moveTo(padding - 5, padding + fontSize * 0.65);
        lctx.lineTo(padding + textWidth + 5, padding + fontSize * 0.6 + (Math.random() - 0.5) * fontSize * 0.2);
        lctx.stroke();
    }

    // chalk grain: dense speckle brightness variation confined to the glyph pixels
    lctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < w * h * 0.18; i++) {
        lctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)';
        lctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }

    // chalk dust smears: soft low-opacity smudges
    for (let i = 0; i < 10; i++) {
        lctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.15})`;
        lctx.beginPath();
        lctx.arc(Math.random() * w, Math.random() * h, fontSize * (0.2 + Math.random() * 0.3), 0, Math.PI * 2);
        lctx.fill();
    }

    // worn/broken edges: punch random holes and streaks out of the glyphs
    lctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < w * h * 0.035; i++) {
        lctx.fillStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.5})`;
        lctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    for (let i = 0; i < 6; i++) {
        lctx.fillStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.4})`;
        lctx.fillRect(Math.random() * w, Math.random() * h, fontSize * (0.3 + Math.random() * 0.5), 1.5);
    }

    const tilt = (Math.random() - 0.5) * 0.08;
    ctx.save();
    ctx.translate(x, y + fontSize);
    ctx.rotate(tilt);
    ctx.drawImage(layer, -padding, -padding - fontSize);
    ctx.restore();
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
    const height = HEADER_HEIGHT + entries.length * ROW_HEIGHT;
    const canvas = createCanvas(WIDTH, height);
    const ctx = canvas.getContext('2d');

    grungeBackground(ctx, WIDTH, height);

    const titleFontSize = 48;
    const titleWidth = 'BLACKLIST'.length * titleFontSize * 0.65;
    drawChalkText(ctx, 'BLACKLIST', (WIDTH - titleWidth) / 2, 20, `${titleFontSize}px "Blacklist Title"`, titleFontSize, '#e8dcc8');

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const y = HEADER_HEIGHT + i * ROW_HEIGHT;
        const indent = Math.random() * 80;
        const fontSize = 26 + Math.random() * 6;

        drawChalkText(ctx, `${i + 1}  ${entry.username} — ${entry.reason}`, 20 + indent, y, `${fontSize}px "Blacklist Body"`, fontSize, '#e8dcc8', entry.expired);
    }

    return canvas.encode('png');
}
