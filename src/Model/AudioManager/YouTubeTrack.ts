import { Readable } from 'stream';
import Video from '../YouTube/Video.js';
import { AudioTrack } from './index.js';

export class YouTubeTrack extends AudioTrack {
    private cleanup: () => void;
    private abort: () => void;
    private createReadable: () => Readable;
    public Video: Video;

    constructor(vid: Video, createReadable: () => Readable, cleanup: () => void = undefined, abort: () => void = undefined) {
        super();
        this.createReadable = createReadable;
        this.cleanup = cleanup;
        this.abort = abort;
        this.Video = vid;
    }

    public CreateReadable(): Readable {
        return this.createReadable();
    }
    override Cleanup(): void {
        if (this.cleanup) {
            this.cleanup();
        }
    }
    override Abort(): void {
        if (this.abort) {
            this.abort();
        }
    }
}
