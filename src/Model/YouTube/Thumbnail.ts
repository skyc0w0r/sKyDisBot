class Thumbnail {
    public Url: string;
    public Width: number;
    public Height: number;

    constructor(obj?: unknown) {
        this.Url = obj && obj['url'] || '';
        this.Width = obj && obj['width'] || 0;
        this.Height = obj && obj['height'] || 0;
    }
}

export default Thumbnail;
