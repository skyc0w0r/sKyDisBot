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

        (async () => {
            try {
                const res = await fetch(url, {
                    redirect: 'follow',
                    headers: {
                        'User-Agent': this.userAgent,
                    },
                });

                if (!res.ok || res.status !== 200) {
                    pt.destroy(new Error(`Got response code ${res.status}`));
                    return;
                }
                const sz = parseInt(res.headers.get('content-length') || '0');
                this.logger.info(this.identify(url), 'Data size', human.size(sz));
    
                const reader = res.body.getReader();
                while (true) {
                    const chunk = await reader.read();
                    pt.push(chunk.value);

                    if (chunk.done) {
                        break;
                    }
                }
            } catch (error) {
                this.logger.warn(this.identify(url), 'Failed to download:', error);
                if (error instanceof Error) {
                    pt.emit('error', error);
                }
            } finally {
                pt.end();
            }
        })();
        
        return pt;
    }

    private identify(obj: URL): number {
        if (!this.identifiers.has(obj)) {
            this.identifiers.set(obj, ++this.identCount);
        }
        return this.identifiers.get(obj);
    }
}

export default WebLoader;
