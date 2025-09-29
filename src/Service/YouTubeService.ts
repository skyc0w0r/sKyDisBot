import Logger from 'log4js';
import { PassThrough, Readable } from 'stream';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import RequestParamCollection from '../Model/General/RequestParamCollection.js';
import PlaylistItemListResponse from '../Model/YouTube/PlaylistItemListResponse.js';
import SearchResponse from '../Model/YouTube/SearchResponse.js';
import Video from '../Model/YouTube/Video.js';
import VideosResponse from '../Model/YouTube/VideosResponse.js';
import config from '../config.js';
import Innertube from 'youtubei.js';
import { InnerTubeConfig } from 'youtubei.js/dist/src/types/Misc.js';

const YT_BASE_DATA_API_ADDRESS = 'https://youtube.googleapis.com/youtube/v3';

class YouTubeService extends BaseService {
    private token: string;
    private logger: Logger.Logger;
    private youtubeAgent: Innertube;

    constructor(accessToken: string) {
        super();
        this.token = accessToken;
        this.logger = Logger.getLogger('youtube');
    }

    public async Init(): Promise<void> {
        const opts: InnerTubeConfig = {};

        const playerId = config.get().YT_PLAYER_ID;
        if (playerId) {
            opts.player_id = playerId;
            this.logger.debug('Set player id', playerId);
        }

        // TODO: add cookies
        const cookie = config.get().YT_CUSTOM_COOKIE;
        if (cookie) {
            opts.cookie = cookie;
            this.logger.debug('Set custom cookie');
        }

        this.youtubeAgent = await Innertube.create(opts);
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

        (async () => {
            let finished = false;
            let validTrack = false;
            let consumedLen = 0;
            let retryCount = 0;

            while (true) {
                try {
                    const videoStream = await this.youtubeAgent.download(id, { type: 'audio' });
                    const reader = videoStream.getReader();
            
                    this.logger.debug(id, 'Started loading stream');
                    let len = 0;
                    while (true) {
                        const chunk = await reader.read();
                        if (chunk.done || !chunk.value) {
                            finished = true;
                            pt.end();
                            this.logger.debug(id, 'Finished loading stream');
                            break;
                        }
            
                        validTrack = true;
                        len += chunk.value.length;
                        if (len >= consumedLen) {
                            pt.push(chunk.value);
                            consumedLen += chunk.value.length;
                        }
                    }
                }
                catch (e) {
                    if (!validTrack) {
                        pt.emit('error', e);
                        break;
                    }
                    retryCount++;
                }
                if (finished) {
                    break;
                }
                if (retryCount >= 3) {
                    pt.emit('error', new Error('Max retries reached'));
                    break;
                }
            }

            if (!finished) {
                this.logger.warn(id, 'Failed to load, destroying stream');
                pt.destroy();
            }
        })();

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
