class VideoContentDetails {
    public Duration: number;

    constructor(obj?: unknown) {
        this.Duration = 0;
        if (obj && obj['duration']) {
            const s = (obj['duration'] as string).toUpperCase();
            let token = '';
            let index = 0;

            while (index < s.length) {
                const c = s.charAt(index);
                switch (c) {
                    case 'P':
                        break;
                    case 'T':
                        break;
                    case 'H':
                        this.Duration += parseInt(token) * 60 * 60;
                        token = '';
                        break;
                    case 'M':
                        this.Duration += parseInt(token) * 60;
                        token = '';
                        break;
                    case 'S':
                        this.Duration += parseInt(token);
                        token = '';
                        break;
                    default:
                        token += c;
                        break;
                }
                index++;
            }
        }
    }
}

export default VideoContentDetails;
