class TrackSecret {
    public Path: string;
    public S: string;
    public Host: string;
    public Ts: string;

    constructor(obj?: unknown) {
        this.Path = obj && obj['path'] || '';
        this.S = obj && obj['s'] || '';
        this.Host = obj && obj['host'] || '';
        this.Ts = obj && obj['ts'] || '';
    }
}

export default TrackSecret;
