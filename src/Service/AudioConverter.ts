import { spawn, spawnSync } from 'child_process';
import Logger from 'log4js';
import { PassThrough, Readable } from 'stream';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import AudioConvertionInfo from '../Model/AudioConverter/AudioConvertionInfo.js';

class AudioConverter extends BaseService {
    private logger: Logger.Logger;
    private ffmpegCmd: string | undefined;
    private inProgress: AudioConvertionInfo[];

    private identifiers: WeakMap<Readable, number>;
    private identCount: number;

    constructor() {
        super();
        this.logger = Logger.getLogger('audio_converter');
        this.inProgress = [];
        this.identifiers = new WeakMap();
        this.identCount = 0;
    }

    public Init(): Promise<void> {
        for (const command of ['ffmpeg', 'avconv', './ffmpeg', './avconv', 'ffmpeg.exe', './ffmpeg.exe']) {
            if (!spawnSync(command, ['-h']).error) {
                this.ffmpegCmd = command;
                this.logger.debug('Found ffmpeg as', command);
                break;
            }
        }
        if (!this.ffmpegCmd) {
            throw new Error('ffmpeg binary not found');
        }
        return Promise.resolve();
    }
    public Destroy(): void {
        for (const info of this.inProgress) {
            this.abortConvertion(info);
        }
    }
    

    public convertForDis(sourceStream: Readable): AudioConvertionInfo {
        if (!this.convertForDis) {
            throw new Error('call init() first');
        }
        this.logger.debug(this.identify(sourceStream), 'Convertion started');

        const child = spawn(this.ffmpegCmd, [
            '-i', 'pipe:0',
            '-vn', '-hide_banner',
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-acodec', 'libopus',
            '-f', 'opus',
            '-ac', '2',
            '-ar', '48000',
            'pipe:1',
        ]);
    
        sourceStream.on('error', (err) => {
            this.logger.debug(this.identify(sourceStream), 'Could not convert stream', err);
            this.abortConvertion(res);
            pt.emit('error', err);
        });
        sourceStream.on('end', () => {
            this.logger.debug(this.identify(sourceStream), 'Stream converted (>end)');
        });
        sourceStream.on('close', () => {
            this.logger.debug(this.identify(sourceStream), 'Stream destroyed (>close)');
            this.abortConvertion(res);
        });
    
        child.stdin.on('error', (e) => this.logger.warn(this.identify(sourceStream), 'in', e));
        child.stdout.on('error', (e) => this.logger.warn(this.identify(sourceStream), 'out', e));
    
        const pt = new PassThrough({
            highWaterMark: 2 * 1024 * 1024,
        });
        const res = new AudioConvertionInfo(sourceStream, pt, child);

        sourceStream.pipe(child.stdin);
        child.stdout.pipe(pt);

        this.inProgress.push(res);
        return res;
    }

    public abortConvertion(info: AudioConvertionInfo): void {
        if (this.inProgress.some(c => c === info)) {
            this.logger.info(this.identify(info.inStream), 'Cleaning up streams and killing child', info.proc.pid);
            info.inStream.unpipe();
            info.inStream.destroy();
            info.outStream.unpipe();
            info.outStream.destroy();
            info.proc.stdout.unpipe();
            info.proc.stdout.destroy();
            if (!info.proc.killed) {
                info.proc.kill('SIGKILL');
            }
    
            this.inProgress = this.inProgress.filter(c => c !== info);
        }
    }

    private identify(obj: Readable): number {
        if (!this.identifiers.has(obj)) {
            this.identifiers.set(obj, ++this.identCount);
        }
        return this.identifiers.get(obj);
    }
}

export default AudioConverter;
