import path from 'path';
import { PassThrough, Readable } from 'stream';
import AudioConverter from '../../Service/AudioConverter.js';
import WebLoader from '../../Service/WebLoader.js';
import { BaseCommand } from '../CommandParser/index.js';
import { AudioTrack } from './index.js';
import { TrackServiceMeta } from './TrackServiceMeta.js';
import { TRACK_TYPE_ENUM } from '../../Enums/TrackType.js';
import { AudioMetaInfo } from '../AudioConverter/AudioMetaInfo.js';

export class WebTrack extends AudioTrack {
    public Url: URL;
    public override get Title(): string {
        return [this.meta.Artist, this.meta.Title].filter(Boolean).join(' - ');
    }
    public override get Duration(): number {
      return this.meta.Duration;
    }
    public override get ServiceMeta(): TrackServiceMeta {
        return {
            name: TRACK_TYPE_ENUM.direct,
            id: this.Url.toString(),
        };
    }
    private meta: AudioMetaInfo;
    private metadataRecievedCallback?: (track: WebTrack, meta: AudioMetaInfo) => void;

    constructor(origin: BaseCommand, url: URL, web: WebLoader, converter: AudioConverter, metadataRecievedCallback: (track: WebTrack, meta: AudioMetaInfo) => void = undefined) {
        super(origin, converter, () => web.getReadableFromUrl(url));

        this.Url = url;
        this.meta = {
            Title: path.basename(decodeURI(this.Url.pathname)),
            Artist: '',
            Duration: 0,
        };
        this.metadataRecievedCallback = metadataRecievedCallback;
    }

    override CreateReadable(): Readable {
        // return super.getSourceStream();
        const s = this.getSourceStream();
        const pt1 = new PassThrough({
            highWaterMark: 2 * 1024 * 1024,
            emitClose: false,
        });
        const pt2 = new PassThrough({
            highWaterMark: 2 * 1024 * 1024,
            emitClose: false,
        });

        s.pipe(pt1);
        s.on('error', e => pt1.emit('error', e));
        s.pipe(pt2);
        s.on('error', e => pt2.emit('error', e));

        this.audioConverter.getMetadata(pt1).then(meta => {
            this.meta = meta;
            if (this.metadataRecievedCallback)
                this.metadataRecievedCallback(this, meta);
        });

        this.info = this.audioConverter.convertForDis(pt2);
        return this.info.outStream;
    }
}
