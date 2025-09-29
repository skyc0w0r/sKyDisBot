import { createWriteStream, existsSync } from 'fs';
import { PassThrough } from 'stream';
import Innertube from 'youtubei.js';
import { describe, expect, it } from 'vitest';

describe('ytdl', () => {
    it('Should download video', { timeout: 10_000 }, async () => {
        const innertube = await Innertube.create({
            player_id: '0004de42',
        });
        
        const data = await innertube.download('AQFIWFABGGc', { type: 'audio' });
        
        const fileStream = createWriteStream('demo.mp4');
        
        const reader = data.getReader();
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) {
                break;
            }

            fileStream.write(chunk.value);
        }
        fileStream.close();

        expect(existsSync('demo.mp4'), 'File created');
    });
    // it('Should abort downloading', async () => {
    //     const s = ytdl('https://www.youtube.com/watch?v=AQFIWFABGGc', {filter: 'audioonly'});
    //     const ws = createWriteStream('track.m4a');
    //     s.pipe(ws);

    //     await new Promise<void>((resolve) => setTimeout(() => resolve(), 5000));

    //     s.destroy(new Error('aboba'));

    //     await new Promise<void>((resolve) => s.on('close', () => resolve()));

    //     expect(s.destroyed).toBeTruthy();
    // });

    // it('Should resume stream', async () => {
    //     jest.setTimeout(30 * 1000);
    //     let s = ytdl('https://www.youtube.com/watch?v=AQFIWFABGGc', {filter: 'audioonly'});
    //     const ws = createWriteStream('track.m4a');

    //     let length = 0;
    //     s.pipe(ws);
    //     s.on('data', (chunk) => {
    //         length += chunk.length;
    //         console.log('chunk >', chunk.length);
    //     });
    //     s.on('error', async () => {
    //         // try recreating
    //         s = ytdl('https://www.youtube.com/watch?v=AQFIWFABGGc', {filter: 'audioonly'});
    //         let newLength = 0;
    //         s.on('data', (chunk) => {
    //             if (newLength >= length) {
    //                 console.log('chunk >>', chunk.length);
    //                 pt.emit('data', chunk);
    //                 return;
    //             }
    //             newLength += chunk.length;
    //             // subChunk
    //         });
    //         const pt = new PassThrough();
    //         pt.pipe(ws);
    //     });

    //     expect(1).toBe(1);
    //     await new Promise<void>((resolve) => setTimeout(() => resolve(), 30 * 1000));
    // });
});
