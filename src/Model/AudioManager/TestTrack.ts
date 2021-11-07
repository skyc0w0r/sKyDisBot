import { Readable } from 'stream';
import AudioTrack from './AudioTrack.js';

class TestTrack extends AudioTrack {
    public Stream: Readable;

    constructor(s: Readable) {
        super();
        this.Stream = s;
    }
}

export default TestTrack;
