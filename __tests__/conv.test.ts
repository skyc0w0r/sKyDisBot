import { createReadStream, createWriteStream, existsSync } from 'fs';
import AudioConverter from '../src/Service/AudioConverter.js';

describe('audio conv', () => {

    it('Should convert audio file', async () => {
        const cv = new AudioConverter();
        const s = createReadStream('ЮГ 404 - НАЙДИ МЕНЯ (2018).mp3');

        const info = cv.convertForDis(s);
        const ws = createWriteStream('aboba.opus');

        info.outStream.pipe(ws);

        await new Promise<void>(resolve => {
            info.outStream.on('end', () => resolve());
        });

        expect(existsSync('aboba.opus')).toBeTruthy();
    });
});
