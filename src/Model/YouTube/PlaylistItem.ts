import VideoSnippet from './VideoSnippet.js';

class PlaylistItem {
    public Snippet: VideoSnippet;

    constructor(obj?: unknown) {
        this.Snippet = new VideoSnippet(obj && obj['snippet']);
    }
}

export default PlaylistItem;
