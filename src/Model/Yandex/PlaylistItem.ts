import Track from './Track.js';

class PlaylistItem {
    public Track: Track;

    constructor(obj?: unknown) {
        this.Track = new Track(obj && obj['track'] || undefined);
    }
}

export default PlaylistItem;
