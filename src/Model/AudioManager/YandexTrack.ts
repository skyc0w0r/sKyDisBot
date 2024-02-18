import AudioConverter from '../../Service/AudioConverter.js';
import YandexService from '../../Service/YandexService.js';
import { BaseCommand } from '../CommandParser/BaseCommand.js';
import Track from '../Yandex/Track.js';
import { AudioTrack } from './AudioTrack.js';

export class YandexTrack extends AudioTrack {
    public override get Title(): string {
        return this.Track?.Title || super.Title;
    }
    public override get Duration(): number {
      return this.Track?.Duration || super.Duration;
    }
    public Track: Track;

    constructor(origin: BaseCommand, track: Track, ym: YandexService, converter: AudioConverter) {
        super(origin, converter, () => ym.getAudioStream(track.Id));

        this.Track = track;
    }
}
