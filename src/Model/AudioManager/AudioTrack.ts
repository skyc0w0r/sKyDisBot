import EventEmitter from 'events';
import { PassThrough, Readable } from 'stream';
import AudioConverter from '../../Service/AudioConverter.js';
import AudioConvertionInfo from '../AudioConverter/AudioConvertionInfo.js';
import { BaseCommand } from '../CommandParser/BaseCommand.js';
import { YouTubeTrack, WebTrack, YandexTrack } from './index.js';

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

    public isYouTubeTrack(): this is YouTubeTrack {
        return this instanceof YouTubeTrack;
    }
    public isWebTrack(): this is WebTrack {
        return this instanceof WebTrack;
    }
    public isYandexMusicTrack(): this is YandexTrack {
        return this instanceof YandexTrack;
    }
}
