import { describe, expect, it } from 'vitest';
import { RenderBlacklist } from '../src/Helpers/BlacklistCanvas';

describe('RenderBlacklist', () => {
    it('renders a PNG with one row per entry', async () => {
        const buffer = await RenderBlacklist([
            { username: 'racer_one', reason: 'Reckless driving', expired: false },
            { username: 'racer_two', reason: 'Street racing', expired: true },
        ]);

        expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    });

    it('renders an empty list without entries', async () => {
        const buffer = await RenderBlacklist([]);

        expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    });

    it('does not blow up or crash on an extremely long reason', async () => {
        const buffer = await RenderBlacklist([
            { username: 'racer_one', reason: 'a'.repeat(500), expired: false },
        ]);

        expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    });
});
