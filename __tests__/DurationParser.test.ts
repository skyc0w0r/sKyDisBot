import { describe, expect, it } from 'vitest';
import { parseDuration } from '../src/Helpers/DurationParser';

describe('parseDuration', () => {
    it('parses a single unit', () => {
        expect(parseDuration('1d')).toBe(24 * 60 * 60 * 1000);
    });

    it('parses combined units', () => {
        expect(parseDuration('2w3d5h')).toBe(
            2 * 7 * 24 * 60 * 60 * 1000 + 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000
        );
    });

    it('treats "0" and "permanent" as no expiry', () => {
        expect(parseDuration('0')).toBeNull();
        expect(parseDuration('permanent')).toBeNull();
    });

    it('returns undefined for invalid input', () => {
        expect(parseDuration('abc')).toBeUndefined();
        expect(parseDuration('')).toBeUndefined();
    });
});
