import { createWriteStream } from 'fs';
import { PassThrough } from 'stream';
import ytdl from 'ytdl-core';

describe('ytdl', () => {
    it('Should abort downloading', async () => {
        const s = ytdl('https://www.youtube.com/watch?v=AQFIWFABGGc', {filter: 'audioonly'});
        const ws = createWriteStream('track.m4a');
        s.pipe(ws);

        await new Promise<void>((resolve) => setTimeout(() => resolve(), 5000));

        s.destroy(new Error('aboba'));

        await new Promise<void>((resolve) => s.on('close', () => resolve()));

        expect(s.destroyed).toBeTruthy();
    });

    it('Should resume stream', async () => {
        jest.setTimeout(30 * 1000);
        let s = ytdl('https://www.youtube.com/watch?v=AQFIWFABGGc', {filter: 'audioonly'});
        const ws = createWriteStream('track.m4a');

        let length = 0;
        s.pipe(ws);
        s.on('data', (chunk) => {
            length += chunk.length;
            console.log('chunk >', chunk.length);
        });
        s.on('error', async () => {
            // try recreating
            s = ytdl('https://www.youtube.com/watch?v=AQFIWFABGGc', {filter: 'audioonly'});
            let newLength = 0;
            s.on('data', (chunk) => {
                if (newLength >= length) {
                    console.log('chunk >>', chunk.length);
                    pt.emit('data', chunk);
                    return;
                }
                newLength += chunk.length;
                // subChunk
            });
            const pt = new PassThrough();
            pt.pipe(ws);
        });

        expect(1).toBe(1);
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 30 * 1000));
    });
});
