import Logger from 'log4js';
import fetch from 'node-fetch';
import { PassThrough, Readable } from 'stream';
import human from '../human.js';
import { BaseService } from '../Interface/ServiceManagerInterface.js';

class WebLoader extends BaseService {
    private logger: Logger.Logger;
    private identifiers: WeakMap<URL, number>;
    private identCount: number;
    private userAgent: string;

    constructor(userAgent?: string) {
        super();
        this.logger = Logger.getLogger('web_loader');
        this.identifiers = new WeakMap<URL, number>();
        this.identCount = 0;
        this.userAgent = userAgent || 'sKyDisBot/1.0';
    }

    Init(): void {
        return;
    }
    Destroy(): void {
        return;
    }

    public getReadableFromUrl(url: URL): Readable {
        this.logger.info(this.identify(url), 'Starting download from', url.hostname);
        const pt = new PassThrough({
            highWaterMark: 10 * 1024 * 1024
        });
        fetch(url.toString(), {
            redirect: 'follow',
            headers: {
                'User-Agent': this.userAgent,
            },
        }).then(res => {
            if (!res.ok) {
                pt.end();
                pt.destroy();
                return;
            }
            const sz = parseInt(res.headers.get('content-length') || '0');
            // let szDown = 0;
            this.logger.info(this.identify(url), 'Data size', human.size(sz));

            let finished = false;
            res.body.on('data', (chunk) => {
                // szDown += chunk.length;
                // this.logger.trace(this.identify(url), 'progress', szDown, '/', sz);
                pt.push(chunk);
            });
            res.body.on('close', () => {
                if (!finished) {
                    this.logger.info(this.identify(url), 'Download aborted (>close)');
                    pt.emit('close');
                }
            });
            res.body.on('end', () => {
                finished = true;
                this.logger.info(this.identify(url), 'Download finished (>end)');
                pt.end();
            });
            res.body.on('error', (e) => {
                this.logger.warn(this.identify(url), 'Download error', e);
                pt.emit('error', e);
            });

            pt.on('close', () => {
                if (res.body && !finished) {  
                    this.logger.warn(this.identify(url), 'Trying to abort');
                    // res.body is actually a PassThrough, but types are messed up with node-fetch
                    (res.body as unknown as Readable).destroy();
                }
            });
        }).catch(e => {
            this.logger.warn(this.identify(url), 'Failed to download', e);
            pt.emit('close');
            pt.destroy();
        });
        
        return pt;
    }

    // private async download(url: URL, maxRetries = 0): ReturnType<typeof fetch> {
    //     const res = await fetch(url.toString(), { redirect: 'follow' });
    //     return res;
    // }

    private identify(obj: URL): number {
        if (!this.identifiers.has(obj)) {
            this.identifiers.set(obj, ++this.identCount);
        }
        return this.identifiers.get(obj);
    }
}

export default WebLoader;
