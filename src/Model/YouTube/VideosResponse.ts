import Video from './Video.js';

class VideosResponse {
    public Items: Array<Video>;
    
    constructor(obj?: unknown) {
        this.Items = new Array<Video>();
        if (obj && obj['items'] && Array.isArray(obj['items'])) {
            for (const e of obj['items']) {
                this.Items.push(new Video(e));
            }
        }
    }
}

export default VideosResponse;
