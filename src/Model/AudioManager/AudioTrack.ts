import { Readable } from 'stream';
import { YouTubeTrack } from './index.js';

export abstract class AudioTrack {
    public abstract CreateReadable(): Readable;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public Cleanup(): void { };
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public Abort(): void { };

    public isYouTubeTrack(): this is YouTubeTrack {
        return this instanceof YouTubeTrack;
    }
}
