import { ChildProcess } from 'child_process';
import { Readable } from 'stream';

class AudioConvertionInfo {
    public readonly inStream: Readable;
    public readonly outStream: Readable;
    public readonly proc: ChildProcess;
    constructor(inS: Readable, outS: Readable, proc: ChildProcess) {
        this.inStream = inS;
        this.outStream = outS;
        this.proc = proc;
    }
}

export default AudioConvertionInfo;
