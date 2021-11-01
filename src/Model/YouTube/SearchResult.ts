class SearchResult {
    public Id: string;
    constructor(obj?: unknown) {
        this.Id = obj && obj['id'] && obj['id']['videoId'] || '';
    }
}

export default SearchResult;
