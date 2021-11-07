import { Readable } from 'stream';
import AudioTrack from './AudioTrack.js';

class YouTubeTrack extends AudioTrack {
    public Stream: Readable;
    private cleanup: () => void;

    constructor(s: Readable, cleanup: () => void = undefined) {
        super();
        this.Stream = s;
        this.cleanup = cleanup;
    }

    override Cleanup(): void {
        if (this.cleanup) {
            this.cleanup();
        }
    }
    
}

export default YouTubeTrack;
