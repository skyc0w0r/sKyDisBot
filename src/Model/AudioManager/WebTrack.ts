import AudioConverter from '../../Service/AudioConverter.js';
import WebLoader from '../../Service/WebLoader.js';
import { BaseCommand } from '../CommandParser/index.js';
import { AudioTrack } from './index.js';

export class WebTrack extends AudioTrack {
    public Url: URL; 

    constructor(origin: BaseCommand, url: URL, web: WebLoader, converter: AudioConverter) {
        super(origin, converter, () => web.getReadableFromUrl(url));

        this.Url = url;
    }
}
