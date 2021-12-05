import EventEmitter from 'events';
import { Readable } from 'stream';
import AudioConverter from '../../Service/AudioConverter.js';
import AudioConvertionInfo from '../AudioConverter/AudioConvertionInfo.js';
import { BaseCommand } from '../CommandParser/BaseCommand.js';
import { YouTubeTrack, WebTrack } from './index.js';

export class AudioTrack extends EventEmitter {
    public Origin: BaseCommand;
    private getSourceStream: () => Readable;
    private audioConverter: AudioConverter;
    private info: AudioConvertionInfo;
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
        const stream = this.getSourceStream();
        this.info = this.audioConverter.convertForDis(stream);
        return this.info.outStream;
    }
    public Cleanup(): void {
        if (this.info) {
            this.audioConverter.abortConvertion(this.info);
        }
    };

    public isYouTubeTrack(): this is YouTubeTrack {
        return this instanceof YouTubeTrack;
    }
    public isWebTrack(): this is WebTrack {
        return this instanceof WebTrack;
    }
}
