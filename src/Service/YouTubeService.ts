import Logger from 'log4js';
import { PassThrough, Readable } from 'stream';
// import ytdl from 'ytdl-core';
import ytdl from '@distube/ytdl-core';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import RequestParamCollection from '../Model/General/RequestParamCollection.js';
import PlaylistItemListResponse from '../Model/YouTube/PlaylistItemListResponse.js';
import SearchResponse from '../Model/YouTube/SearchResponse.js';
import Video from '../Model/YouTube/Video.js';
import VideosResponse from '../Model/YouTube/VideosResponse.js';
import config from '../config.js';

const YT_BASE_DATA_API_ADDRESS = 'https://youtube.googleapis.com/youtube/v3';

class YouTubeService extends BaseService {
    private token: string;
    private logger: Logger.Logger;
    private ytdlAgent: ytdl.Agent;

    constructor(accessToken: string) {
        super();
        this.token = accessToken;
        this.logger = Logger.getLogger('youtube');
    }

    public Init(): void {
        const cookieString = config.get().YT_CUSTOM_COOKIE;
        const cookies = cookieString
            .split('; ')
            .filter(c => c)
            .map(c => c.split('='))
            .map(c => ({ name: c[0], value: c.slice(1).join('=') }));

        this.logger.debug('Cookies', cookies);
        this.ytdlAgent = ytdl.createAgent(cookies);
    }

    public Destroy(): void {
        return;
    }


    public async getVideoInfo(id: string): Promise<Video | null> {
        const r = await this.getData('videos', VideosResponse, {
            part: 'id,contentDetails,snippet',
            id
        });
        return r.Items.length > 0 ? r.Items[0] : null;
    }

    public async search(q: string): Promise<Array<Video>> {
        this.logger.info('Searching for:', q);
        const r1 = await this.getData('search', SearchResponse, {
            part: 'id',
            maxResults: 10,
            type: 'video',
            q
        });
        const r2 = await this.getData('videos', VideosResponse, {
            part: 'id,contentDetails,snippet',
            id: r1.Items.map(c => c.Id).join(','),
        });
        this.logger.info('Found', r2.Items.length, 'results');
        return r2.Items;
    }

    public async getPlaylist(id: string): Promise<Array<Video>> {
        const items = new Array<Video>();
        let nextPageToken;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const r1params: RequestParamCollection = {
                part: 'id,snippet',
                maxResults: 50,
                playlistId: id,
            };
            if (nextPageToken) {
                r1params['pageToken'] = nextPageToken;
            }
            const r1 = await this.getData('playlistItems', PlaylistItemListResponse, r1params);
            const r2 = await this.getData('videos', VideosResponse, {
                part: 'id,contentDetails,snippet',
                id: r1.Items.map(c => c.Snippet.ResourceId).join(','),
            });
            items.push(...r2.Items);

            nextPageToken = r1.NextPageToken;
            if (!nextPageToken) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        return items;
    }

    public getAudioStream(id: string): Readable {
        // return ytdl(id, { filter: 'audioonly' });
        const pt = new PassThrough({
            highWaterMark: 10 * 1024 * 1024,
        });
        let finished = false;
        let validTrack = false;
        const watchIt = (begin = 0, retry = 0) => new Promise<void>((resolve) => {
            const opts: ytdl.downloadOptions = {
                filter: 'audioonly',
                // agent: this.ytdlAgent
            };
            const src = ytdl(id, opts);
            let len = 0;
            src.on('data', (chunk: Uint8Array) => {
                validTrack = true;
                len += chunk.length;
                if (len >= begin) {
                    // pt.emit('data', chunk);
                    pt.push(chunk);
                }
            });
            src.on('close', () => {
                if (!finished) {
                    pt.destroy();
                    resolve();
                }
            });
            src.on('end', () => {
                finished = true;
                pt.end();
                resolve();
            });
            src.on('error', (e) => {
                // if (Object.keys(e).some(c => c === 'statusCode') && e['statusCode'] === 410) {
                //     pt.emit('error', e);
                // } else
                if (!validTrack) {
                    pt.emit('error', e);
                } else if (retry > 4) {
                    this.logger.warn('Retry', retry, 'for', id, 'with error:', e);
                    pt.emit('error', new Error('Max retries reached'));
                } else {
                    watchIt(len, retry + 1);
                }
                resolve();
            });
            pt.on('close', () => {
                if (src && !finished) {
                    src.destroy();
                }
            });
        });
        watchIt();
        return pt;
    }

    private async getData<Type>(method: string, TypeNew: new (obj?: unknown) => Type, params?: RequestParamCollection): Promise<Type> {
        let url = `${YT_BASE_DATA_API_ADDRESS}/${method}?key=${this.token}&`;
        if (params) {
            const paramString = Object.keys(params).map(p => `${p}=${encodeURIComponent(params[p] as string)}`).join('&');
            url += paramString;
        }
        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!resp.ok) {
            throw new Error(`Failed to get /${method}: ${resp.status} ${resp.statusText}`);
        }
        const j = await resp.json();
        return new TypeNew(j);
    }
}

export default YouTubeService;
