const UNIT_MS: Record<string, number> = {
    w: 7 * 24 * 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
};

// Parses compact duration strings like "1d" or "2w3d5h" (weeks/days/hours/minutes).
// Returns null for "0"/"permanent" (no expiry), undefined if the string is not a valid duration.
export function parseDuration(raw: string): number | null | undefined {
    if (!raw) return undefined;
    if (raw === '0' || raw.toLowerCase() === 'permanent') return null;

    const regex = /(\d+)([wdhm])/gi;
    let match: RegExpExecArray | null;
    let totalMs = 0;
    let matchedAnything = false;

    while ((match = regex.exec(raw))) {
        matchedAnything = true;
        totalMs += parseInt(match[1], 10) * UNIT_MS[match[2].toLowerCase()];
    }

    return matchedAnything ? totalMs : undefined;
}
