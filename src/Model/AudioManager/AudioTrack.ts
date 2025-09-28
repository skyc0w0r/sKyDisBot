import EventEmitter from 'events';
import { Readable } from 'stream';
import AudioConverter from '../../Service/AudioConverter.js';
import AudioConvertionInfo from '../AudioConverter/AudioConvertionInfo.js';
import { BaseCommand } from '../CommandParser/BaseCommand.js';

export class AudioTrack extends EventEmitter {
    public Origin: BaseCommand;
    public get Title(): string {
        return 'Unkown track';
    }
    public get Duration(): number {
      return 0;
    }
    protected getSourceStream: () => Readable;
    protected audioConverter: AudioConverter;
    protected info: AudioConvertionInfo;
    /**
     *
     */
    constructor(origin: BaseCommand, converter: AudioConverter, getSourceStream: () => Readable) {
        super();
        this.Origin = origin;
        this.getSourceStream = getSourceStream;
        this.audioConverter = converter;
    }
    public CreateReadable(): Readable {
        // if (this.info) {
        //     const pt = new PassThrough({highWaterMark: 1 * 1024 * 1024});
        //     this.info.outStream.pipe(pt);
        //     return pt;
        // }
        const stream = this.getSourceStream();
        this.info = this.audioConverter.convertForDis(stream);
        // return this.CreateReadable();
        return this.info.outStream;
    }
    public Cleanup(): void {
        if (this.info) {
            this.audioConverter.abortConvertion(this.info);
        }
    }
}
