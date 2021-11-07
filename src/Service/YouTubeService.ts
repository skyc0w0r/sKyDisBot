import Logger from 'log4js';
import { PassThrough, Readable } from 'stream';
import ytdl from 'ytdl-core';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import RequestParamCollection from '../Model/General/RequestParamCollection.js';
import SearchResponse from '../Model/YouTube/SearchResponse.js';
import Video from '../Model/YouTube/Video.js';
import VideosResponse from '../Model/YouTube/VideosResponse.js';

const YT_BASE_DATA_API_ADDRESS = 'https://youtube.googleapis.com/youtube/v3';

class YouTubeService extends BaseService {
    private token: string;
    private logger: Logger.Logger;
    constructor(accessToken: string) {
        super();
        this.token = accessToken;
        this.logger = Logger.getLogger('youtube');
    }

    public Init(): void {
        return;
    }
    public Destroy(): void {
        return;
    }
    

    public async getVideoInfo(id: string): Promise<Video | null> {
        const r = await this.getData('videos', VideosResponse, {
            part: 'contentDetails,snippet',
            id
        });
        return r.Items.length > 0 ? r.Items[0] : null;
    }

    public async search(q: string): Promise<Array<Video>> {
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
        return r2.Items;
    }

    public getAudioStream(id: string): Readable {
        // return ytdl(id, { filter: 'audioonly' });
        const pt = new PassThrough({highWaterMark: 1 * 1024 * 1024});
        let validTrack = false;
        const watchIt = (begin = 0, retry = 0) => new Promise<void>((resolve) => {
            const src = ytdl(id, { filter: 'audioonly' });
            let len = 0;
            src.on('data', (chunk: Uint8Array) => {
                validTrack = true;
                len += chunk.length;
                if (len >= begin) {
                    pt.emit('data', chunk);
                }
            });
            src.on('close', () => {
                pt.emit('close');
                resolve();
            });
            src.on('end', () => {
                pt.emit('end');
                resolve();
            });
            src.on('error', (e) => {
                // if (Object.keys(e).some(c => c === 'statusCode') && e['statusCode'] === 410) {
                //     pt.emit('error', e);
                // } else
                if (!validTrack) {
                    pt.emit('error', e);
                } else
                if (retry > 4) {
                    this.logger.warn('Retry', retry, 'for', id, 'with error:', e);
                    pt.emit('error', new Error('Max retries reached'));
                } else {
                    watchIt(len, retry + 1);
                }
                resolve();
            });
            pt.on('close', () => {
                if (src) {
                    src.destroy();
                }
            });
        });
        watchIt();
        return pt;
    }

    private async getData<Type>(method: string, TypeNew: new(obj?: unknown) => Type, params?: RequestParamCollection): Promise<Type> {
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
};

export default YouTubeService;
