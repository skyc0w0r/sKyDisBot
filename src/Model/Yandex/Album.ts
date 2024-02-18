import Track from './Track.js';

class Album {
    public Title: string;
    public TrackCount: number;
    public Tracks: Array<Track>;

    constructor(obj?: unknown) {
        this.Title = obj && obj['title'] || '';
        this.TrackCount = obj && obj['trackCount'] || 0;
        this.Tracks = [];
        if (obj && obj['volumes'] && Array.isArray(obj['volumes'])) {
            for (const volume of obj['volumes']) {
                if (volume && Array.isArray(volume)) {
                    for (const track of volume) {
                        this.Tracks.push(new Track(track));
                    }
                }
            }
        }
    }
}

export default Album;
