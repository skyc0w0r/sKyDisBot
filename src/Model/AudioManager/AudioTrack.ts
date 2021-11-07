import { Readable } from 'stream';

abstract class AudioTrack {
    public abstract get Stream(): Readable;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public Cleanup(): void { };
}

export default AudioTrack;
