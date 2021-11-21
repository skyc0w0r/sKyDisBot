import { Readable } from 'stream';
import { AudioTrack } from './index.js';

export class TestTrack extends AudioTrack {
    public f: () => Readable;
    public CreateReadable(): Readable {
        throw new Error('Method not implemented.');
    }

    constructor(f: () => Readable) {
        super();
        this.f = f;
    }
}
