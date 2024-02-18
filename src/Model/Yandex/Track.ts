import Artist from './Artist.js';

class Track {
    public Id: string;
    public Title: string;
    public Duration: number;
    public Artists: Array<Artist>;
    public CoverUri: string;

    constructor(obj?: unknown) {
        this.Id = obj && obj['id'] || '';
        this.Title = obj && obj['title'] || '';
        this.Duration = Math.round(obj && obj['durationMs'] / 1000 || 0);
        this.Artists = obj && obj['artists'] && Array.isArray(obj['artists']) && obj['artists'].map(x => new Artist(x)) || [];
        this.CoverUri = obj && obj['coverUri'] && `https://${obj['coverUri']}` || '';
    }
}

export default Track;
