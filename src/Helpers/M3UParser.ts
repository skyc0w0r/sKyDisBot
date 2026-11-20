export interface M3UEntry {
    url: URL;
    title?: string;
    duration?: number;
}

const EXTINF_RE = /^#EXTINF:(-?\d+(?:\.\d+)?),(.*)$/;

export function parseM3U(text: string, baseUrl: URL): M3UEntry[] {
    const entries: M3UEntry[] = [];
    let pending: { title?: string; duration?: number } | undefined;

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }

        if (line.startsWith('#')) {
            const m = EXTINF_RE.exec(line);
            if (m) {
                const duration = Number(m[1]);
                pending = {
                    title: m[2] || undefined,
                    duration: duration > 0 ? duration : undefined,
                };
            }
            continue;
        }

        try {
            const url = new URL(line, baseUrl);
            entries.push({ url, title: pending?.title, duration: pending?.duration });
        } catch {
            // skip malformed entry line
        }
        pending = undefined;
    }

    return entries;
}
