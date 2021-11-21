import Thumbnail from './Thumbnail.js';

const THUMB_QUALITY = [ 'maxres', 'standard', 'high', 'medium', 'default' ];

class VideoSnippet {
    public PublishedAt?: Date;
    public Title: string;
    public Description: string;
    public Thumbnails: { [key: string]: Thumbnail };
    public ChannelTitle: string;
    public ResourceId: string;

    constructor(obj?: unknown) {
        this.PublishedAt = obj && obj['publishedAt'] && new Date(obj['publishedAt']) || null;
        this.Title = obj && obj['title'] || '';
        this.Description = obj && obj['description'] || '';
        this.Thumbnails = {};
        if (obj && obj['thumbnails']) {
            for (const key in obj['thumbnails']) {
                this.Thumbnails[key] = new Thumbnail(obj['thumbnails'][key]);
            }
        }
        this.ChannelTitle = obj && obj['channelTitle'] || '';

        this.ResourceId = obj && obj['resourceId'] && obj['resourceId']['videoId'] || '';
    }

    get bestThumbnail(): Thumbnail {
        return this.limitedThumbnail(10_000);
    }

    limitedThumbnail(maxLength: number): Thumbnail {
        for (const key of THUMB_QUALITY) {
            const thumb = this.Thumbnails[key];
            if (thumb && thumb.Height <= maxLength && thumb.Width <= maxLength) {
                return thumb;
            }
        }
        return null;
    }
}

export default VideoSnippet;
