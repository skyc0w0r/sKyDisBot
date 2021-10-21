import fetch from 'node-fetch';
import ytdl from 'ytdl-core';
import { Readable } from 'stream';
import RequestParamCollection from '../Model/RequestParamCollection.js';
import Video from '../Model/YouTube/Video.js';
import VideosResponse from '../Model/YouTube/VideosResponse.js';

const YT_BASE_DATA_API_ADDRESS = 'https://youtube.googleapis.com/youtube/v3';

class YouTubeApi {
    private token: string;
    constructor(accessToken: string) {
        this.token = accessToken;
    }

    public async getVideoInfo(id: string): Promise<Video | null> {
        const r = await this.getData('videos', VideosResponse, {
            part: 'contentDetails,snippet',
            id
        });
        return r.Items.length > 0 ? r.Items[0] : null;
    }

    public getAudioStream(id: string): Readable {
        return ytdl(id, { filter: 'audioonly' });
    }

    private async getData<Type>(method: string, TypeNew: new(obj?: unknown) => Type, params?: RequestParamCollection): Promise<Type> {
        let url = `${YT_BASE_DATA_API_ADDRESS}/${method}?key=${this.token}&`;
        if (params) {
            const paramString = Object.keys(params).map(p => `${p}=${escape(params[p] as string)}`).join('&');
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

export default YouTubeApi;
