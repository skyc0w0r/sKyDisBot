import { describe, expect, it } from 'vitest';
import { parseM3U } from '../src/Helpers/M3UParser';

const base = new URL('https://skycolor.top/mashup/mm44%20turbo%20shitpost%20machine/playlist.m3u8');

describe('parseM3U', () => {
    it('parses sample playlist with relative entries and EXTINF titles', () => {
        const text = [
            '#EXTM3U',
            '#EXTART:mm44 turbo shitpost machine',
            '#EXTALB:Я ПОЧИНИЛ ГОРГОРОД',
            '',
            '#EXTINF:50,Не с начала',
            '01.01 Не с начала.mp3',
            '#EXTINF:93,Привет, это Кира',
            '01.02 Привет, это Кира.mp3',
        ].join('\n');

        const entries = parseM3U(text, base);

        expect(entries).toHaveLength(2);
        expect(entries[0].title).toBe('Не с начала');
        expect(entries[0].duration).toBe(50);
        expect(entries[0].url.toString()).toBe(new URL('01.01 Не с начала.mp3', base).toString());
        expect(entries[1].title).toBe('Привет, это Кира');
        expect(entries[1].duration).toBe(93);
    });

    it('returns empty array for playlist with no entries', () => {
        expect(parseM3U('#EXTM3U\n', base)).toEqual([]);
    });

    it('returns empty array for empty input', () => {
        expect(parseM3U('', base)).toEqual([]);
    });

    it('handles mixed absolute and relative entries', () => {
        const text = [
            '#EXTM3U',
            '#EXTINF:10,Relative',
            'track1.mp3',
            '#EXTINF:20,Absolute',
            'https://other.host/track2.mp3',
        ].join('\n');

        const entries = parseM3U(text, base);

        expect(entries).toHaveLength(2);
        expect(entries[0].url.toString()).toBe(new URL('track1.mp3', base).toString());
        expect(entries[1].url.toString()).toBe('https://other.host/track2.mp3');
    });

    it('skips a malformed entry line but keeps valid ones', () => {
        const text = [
            '#EXTINF:10,Good one',
            'good.mp3',
            '#EXTINF:20,Bad one',
            'http://host:abc/', // invalid port -> URL constructor throws
            '#EXTINF:30,Good two',
            'good2.mp3',
        ].join('\n');

        const entries = parseM3U(text, base);

        expect(entries.map(e => e.title)).toEqual(['Good one', 'Good two']);
    });

    it('leaves title/duration undefined when entry has no preceding EXTINF', () => {
        const entries = parseM3U('bare.mp3', base);

        expect(entries).toHaveLength(1);
        expect(entries[0].title).toBeUndefined();
        expect(entries[0].duration).toBeUndefined();
    });
});
