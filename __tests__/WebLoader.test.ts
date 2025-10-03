import { createWriteStream, existsSync, unlinkSync } from 'fs';
import { describe, expect, it } from 'vitest';
import WebLoader from '../src/Service/WebLoader';
import path from 'path';
import { pipeline } from 'stream';

describe('WebLoader', { timeout: 10_000 }, () => {
    it('Should download file', async () => {
        const wl = new WebLoader();

        const fileName = path.join('__tests__', 'test.png');
        if (existsSync(fileName)) {
            unlinkSync(fileName);
        }

        const webStream = wl.getReadableFromUrl(new URL('https://skycolor.top/lol.png'));

        const fileStream = createWriteStream(fileName);

        await new Promise<void>((resolve, reject) => {
            pipeline(webStream, fileStream, (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });

        expect(existsSync(fileName)).toBeTruthy();
        unlinkSync(fileName);
    });
});
