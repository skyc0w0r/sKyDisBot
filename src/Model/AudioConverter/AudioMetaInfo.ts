export class AudioMetaInfo {
    public Artist: string;
    public Title: string;
    public Duration: number;

    constructor(artist: string, title: string, duration: number) {
        this.Artist = artist;
        this.Title = title;
        this.Duration = duration;
    }
}
