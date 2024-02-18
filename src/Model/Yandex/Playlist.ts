import PlaylistItem from './PlaylistItem.js';

class Playlist {
    public Title: string;
    public TrackCount: number;
    public Tracks: Array<PlaylistItem>;
    public Duration: number;

    constructor(obj?: unknown) {
        this.Title = obj && obj['title'] || '';
        this.TrackCount = obj && obj['trackCount'] || 0;
        this.Tracks = obj && obj['tracks'] && Array.isArray(obj['tracks']) && obj['tracks'].map(x => new PlaylistItem(x)) || [];
        this.Duration = Math.round(obj && obj['durationMs'] / 1000 || 0);
    }
}

export default Playlist;
