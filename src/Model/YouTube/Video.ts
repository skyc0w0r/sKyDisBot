import VideoContentDetails from './VideoContentDetails.js';
import VideoSnippet from './VideoSnippet.js';

class Video {
    public Snippet?: VideoSnippet;
    public ContentDetails?: VideoContentDetails;
    public Id?: string;

    constructor(obj?: unknown) {
        this.Snippet = obj && obj['snippet'] && new VideoSnippet(obj['snippet']) || null;
        this.ContentDetails = obj && obj['contentDetails'] && new VideoContentDetails(obj['contentDetails']) || null;
        this.Id = obj && obj['id'] && obj['id'] || '';
    }
}

export default Video;
