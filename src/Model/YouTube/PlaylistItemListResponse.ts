import PlaylistItem from './PlaylistItem.js';

class PlaylistItemListResponse {
    public NextPageToken: string;
    public PrevPageToken: string;
    public Items: PlaylistItem[];
    constructor(obj?: unknown) {
        this.NextPageToken = obj && obj['nextPageToken'] || '';
        this.PrevPageToken = obj && obj['prevPageToken'] || '';
        this.Items = new Array<PlaylistItem>();

        if (obj && obj['items'] && Array.isArray(obj['items'])) {
            for (const e of obj['items']) {
                this.Items.push(new PlaylistItem(e));
            }
        }
    }
}

export default PlaylistItemListResponse;
