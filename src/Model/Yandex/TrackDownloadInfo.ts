class TrackDownloadInfo {
    /**
     * Кодек аудиофайла
     */
    public Codec: 'mp3' | 'aac';
    /**
     * Усиление
     */
    public Gain: boolean;
    /**
     * Предварительный просмотр
     */
    public Preview: string;
    /**
     * Ссылка на XML документ содержащий данные для загрузки трека
     */
    public DownloadInfoUrl: string;
    /**
     * Прямая ли ссылка
     */
    public Direct: boolean;
    /**
     * Битрейт аудиофайла в кбит/с
     */
    public BitrateInKbps: number;

    constructor(obj?: unknown) {
        this.Codec = obj && obj['codec'] || 'aac';
        this.Gain = obj && obj['gain'] || false;
        this.Preview = obj && obj['preview'] || '';
        this.DownloadInfoUrl = obj && obj['downloadInfoUrl'] || '';
        this.Direct = obj && obj['direct'] || false;
        this.BitrateInKbps = obj && obj['bitrateInKbps'] || 0;
    }
}

export default TrackDownloadInfo;
