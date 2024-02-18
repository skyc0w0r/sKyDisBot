import Logger from 'log4js';
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
            this.logger.info(this.identify(url), 'Data size', human.size(sz));

            const reader = res.body.getReader();
            // let readSize = 0;
            const pump = (res: ReadableStreamReadResult<Uint8Array>) => {
                if (res.done) {
                    pt.end();
                    return;
                }
                // readSize += res.value.length;
                // this.logger.trace('read', readSize, 'of', sz);
                
                pt.push(res.value);
                reader.read().then(pump);
            };
            
            reader.read().then(pump);
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
