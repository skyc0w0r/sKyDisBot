class Artist {
    public Id: string;
    public Name: string;

    constructor(obj?: unknown) {
        this.Id = obj && obj['id'] || '';
        this.Name = obj && obj['name'] || '';
    }
}

export default Artist;
