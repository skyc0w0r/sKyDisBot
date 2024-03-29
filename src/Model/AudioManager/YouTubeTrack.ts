import AudioConverter from '../../Service/AudioConverter.js';
import YouTubeService from '../../Service/YouTubeService.js';
import { BaseCommand } from '../CommandParser/index.js';
import Video from '../YouTube/Video.js';
import { AudioTrack } from './index.js';

export class YouTubeTrack extends AudioTrack {
    public override get Title(): string {
        return this.Video.Snippet?.Title || super.Title;
    }
    public Video: Video;
    public override get Duration(): number {
      return this.Video?.ContentDetails.Duration || 0;
    }

    constructor(origin: BaseCommand, vid: Video, yt: YouTubeService, converter: AudioConverter) {
        super(origin, converter, () => yt.getAudioStream(vid.Id));

        this.Video = vid;
    }
}
