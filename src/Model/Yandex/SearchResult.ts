import Track from './Track.js';

class SearchResult {
    public Tracks: Array<Track>;
    
    constructor(obj?: unknown) {
        this.Tracks = [];
        if (obj && obj['tracks'] && obj['tracks']['results'] && Array.isArray(obj['tracks']['results'])) {
            for (const track of obj['tracks']['results']) {
                this.Tracks.push(new Track(track));
            }
        }
    }
}

export default SearchResult;
