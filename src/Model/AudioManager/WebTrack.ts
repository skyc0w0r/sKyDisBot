import { Readable } from 'stream';
import { AudioTrack } from './index.js';

class WebTrack extends AudioTrack {
    private cleanup: () => void;
    private abort: () => void;
    private createReadable: () => Readable;

    constructor(createReadable: () => Readable, cleanup: () => void = undefined, abort: () => void = undefined) {
        super();
        this.createReadable = createReadable;
        this.cleanup = cleanup;
        this.abort = abort;
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

export { WebTrack };
