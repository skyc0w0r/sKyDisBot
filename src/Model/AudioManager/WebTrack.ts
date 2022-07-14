import path from 'path';
import { PassThrough, Readable } from 'stream';
import AudioConverter from '../../Service/AudioConverter.js';
import WebLoader from '../../Service/WebLoader.js';
import { BaseCommand } from '../CommandParser/index.js';
import { AudioTrack } from './index.js';

export class WebTrack extends AudioTrack {
    public Url: URL;
    public override get Title(): string {
        return this.title;
    }
    private title: string;
    public override get Duration(): number {
      return this.duration;
    }
    private duration: number;

    constructor(origin: BaseCommand, url: URL, web: WebLoader, converter: AudioConverter) {
        super(origin, converter, () => web.getReadableFromUrl(url));

        this.Url = url;
        this.title = path.basename(decodeURI(this.Url.pathname));
        this.duration = 0;
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
        s.pipe(pt2);

        this.audioConverter.getMetadata(pt1).then(meta => {
            if (meta.Title) {
                if (meta.Artist) {
                    this.title = `${meta.Artist} - ${meta.Title}`;
                }
                this.title = meta.Title;
            }
            this.duration = meta.Duration;
        });

        this.info = this.audioConverter.convertForDis(pt2);
        return this.info.outStream;
    }
}
