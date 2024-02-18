import Logger from 'log4js';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import Track from '../Model/Yandex/Track.js';
import { PassThrough, Readable } from 'stream';
import ApiResponse from '../Model/Yandex/ApiResponse.js';
import TrackDownloadInfo from '../Model/Yandex/TrackDownloadInfo.js';
import TrackSecret from '../Model/Yandex/TrackSecret.js';
import { createHash } from 'crypto';
import WebLoader from './WebLoader.js';
import { GlobalServiceManager } from './ServiceManager.js';
import Playlist from '../Model/Yandex/Playlist.js';
import Album from '../Model/Yandex/Album.js';
import { escape } from 'querystring';
import SearchResult from '../Model/Yandex/SearchResult.js';

const YM_API_HOST = 'https://api.music.yandex.net';

class YandexService extends BaseService {
    private wl: WebLoader;

    private token: string;
    private logger: Logger.Logger;
    
    constructor(accessToken: string) {
        super();
        this.token = accessToken;
        this.logger = Logger.getLogger('yandex_music');
    }

    public Init(): void {
        this.wl = GlobalServiceManager().GetRequiredService(WebLoader);
    }

    public Destroy(): void {
        return;
    }

    public async SearchTrack(q: string): Promise<Array<Track>> {
        this.logger.info('Searching for', q);
        const info = await this.ApiRequest('GET', `/search?type=track&page=0&text=${escape(q)}`);
        const sr = new SearchResult(info.Result);

        this.logger.info('Got search results', sr.Tracks.length);
        return sr.Tracks;
    }

    public async GetAlbum(albumId: string): Promise<Album> {
        this.logger.info('Getting album', albumId);
        const info = await this.ApiRequest('GET', `/albums/${albumId}/with-tracks`);
        const album = new Album(info.Result);

        this.logger.info('Got album', album.Title);
        return album;
    }

    public async GetPlaylist(userId: string, playlistId: string): Promise<Playlist> {
        this.logger.info('Getting playlist', playlistId, 'of', userId);
        const info = await this.ApiRequest('GET', `/users/${userId}/playlists/${playlistId}`);
        const playlist = new Playlist(info.Result);

        this.logger.info('Got playlist', playlist.Title, 'with', playlist.TrackCount, 'tracks');
        return playlist;
    }

    public async GetTrackInfo(trackId: string): Promise<Track | undefined> {
        this.logger.info('Getting info for:', trackId);
        const info = await this.ApiRequest('POST', 'tracks', new URLSearchParams({'track-ids': trackId}));
        const res = info.Results.map(x => new Track(x));

        this.logger.info('Found', res[0]);
        return res[0];
    }

    public async GetDownloadInfo(trackId: string): Promise<Array<TrackDownloadInfo>> {
        const info = await this.ApiRequest('GET', `tracks/${trackId}/download-info`);
        const res = info.Results.map(x => new TrackDownloadInfo(x));

        this.logger.trace('Infos for', trackId, res.length);
        return res;
    }

    public async GetDirectLink(info: TrackDownloadInfo): Promise<string> {
        const res = await fetch(info.DownloadInfoUrl + '&format=json', {
            headers: {
                'Authorization': `OAuth ${this.token}`,
            },
        });
        const obj = await res.json();
        const secret = new TrackSecret(obj);

        const trackUrl = 'XGRlBW9FXlekgbPrRHuSiA' + secret.Path.substring(1) + secret.S;
        const hashedUrl = createHash('md5').update(trackUrl).digest('hex');
        const link = `https://${secret.Host}/get-mp3/${hashedUrl}/${secret.Ts}${secret.Path}`;

        this.logger.trace('Link is', link);
        return link;
    }

    public getAudioStream(trackId: string): Readable {
        const pt = new PassThrough({
            highWaterMark: 10 * 1024 * 1024,
        });

        this.GetDownloadInfo(trackId)
            .then(infos => {
                const info = infos.sort((a, b) => a.BitrateInKbps - b.BitrateInKbps)[0];
                return this.GetDirectLink(info);
            }).then(link => {
                this.wl.getReadableFromUrl(new URL(link)).pipe(pt);
            });

        return pt;
    }

    private async ApiRequest(method: string, handle: string, body?: BodyInit): Promise<ApiResponse> {
        const url = `${YM_API_HOST}/${handle}`;
        const resp = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `OAuth ${this.token}`,
                'Accept-Language': 'ru'
            },
            body: body,
        });

        if (!resp.ok) throw new Error(`Failed to ${method} ${handle}: ${resp.status}${resp.statusText}`);
        const data = await resp.json();
        return new ApiResponse(data);
    }
}

export default YandexService;
