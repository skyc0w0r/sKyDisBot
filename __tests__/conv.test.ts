import { createReadStream, createWriteStream, existsSync } from 'fs';
import AudioConverter from '../src/Service/AudioConverter.js';
import { describe, expect, it } from 'vitest';

describe('audio conv', () => {
    it('Should convert audio file', async () => {
        const cv = new AudioConverter();
        await cv.Init();
        const s = createReadStream('01. Найди Меня.ogg');

        const info = cv.convertForDis(s);
        const ws = createWriteStream('aboba.opus');

        info.outStream.pipe(ws);

        await new Promise<void>(resolve => {
            info.outStream.on('end', () => resolve());
        });

        expect(existsSync('aboba.opus')).toBeTruthy();
    });
});
