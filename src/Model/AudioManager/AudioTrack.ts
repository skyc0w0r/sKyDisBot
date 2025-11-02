import { Readable } from 'stream';
import AudioConverter from '../../Service/AudioConverter.js';
import AudioConvertionInfo from '../AudioConverter/AudioConvertionInfo.js';
import { BaseCommand } from '../CommandParser/BaseCommand.js';
import { TrackServiceMeta } from './TrackServiceMeta.js';

export class AudioTrack {
    public Origin: BaseCommand;
    public get Title(): string {
        return 'Unkown track';
    }
    public get Duration(): number {
      return 0;
    }
    public get ServiceMeta(): TrackServiceMeta {
        throw new Error('This must be overridden!');
    }

    protected getSourceStream: () => Readable;
    protected audioConverter: AudioConverter;
    protected info: AudioConvertionInfo;
    /**
     *
     */
    constructor(origin: BaseCommand, converter: AudioConverter, getSourceStream: () => Readable) {
        this.Origin = origin;
        this.getSourceStream = getSourceStream;
        this.audioConverter = converter;
    }
    public CreateReadable(): Readable {
        const stream = this.getSourceStream();
        this.info = this.audioConverter.convertForDis(stream);
        return this.info.outStream;
    }
    public Cleanup(): void {
        if (this.info) {
            this.audioConverter.abortConvertion(this.info);
        }
    }
}
