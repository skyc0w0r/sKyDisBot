import SearchResult from './SearchResult.js';

class SearchResponse {
    public Items: Array<SearchResult>;
    constructor(obj?: unknown) {
        this.Items = new Array<SearchResult>();
        if (obj && obj['items'] && Array.isArray(obj['items'])) {
            for (const e of obj['items']) {
                this.Items.push(new SearchResult(e));
            }
        }
    }
}

export default SearchResponse;
