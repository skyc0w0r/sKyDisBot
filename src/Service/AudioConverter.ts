import { spawn, spawnSync } from 'child_process';
import Logger from 'log4js';
import { PassThrough, Readable } from 'stream';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import AudioConvertionInfo from '../Model/AudioConverter/AudioConvertionInfo.js';
import { AudioMetaInfo } from '../Model/AudioConverter/AudioMetaInfo.js';

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
        if (!this.ffmpegCmd) {
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
        
        let finished = false;
        sourceStream.on('error', (err) => {
            this.logger.debug(this.identify(sourceStream), 'Could not convert stream', err);
            this.abortConvertion(res);
            pt.emit('error', err);
        });
        sourceStream.on('end', () => {
            finished = true;
            this.logger.debug(this.identify(sourceStream), 'Stream converted (>end)');
        });
        sourceStream.on('close', () => {
            this.logger.debug(this.identify(sourceStream), 'Stream destroyed (>close)');
            if (!finished) {
                this.abortConvertion(res);
            }
        });
    
        child.stdin.on('error', (e) => this.logger.warn(this.identify(sourceStream), 'in', e));
        child.stdout.on('error', (e) => this.logger.warn(this.identify(sourceStream), 'out', e));
    
        const pt = new PassThrough({
            highWaterMark: 10 * 1024 * 1024,
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

    public async getMetadata(sourceStream: Readable): Promise<AudioMetaInfo> {
        if (!this.ffmpegCmd) {
            throw new Error('call init() first');
        }
        this.logger.debug(this.identify(sourceStream), 'Getting meta');

        const child = spawn(this.ffmpegCmd, [
            '-i', 'pipe:0',
            '-hide_banner',
            '-f', 'null', '-'
        ]);
    
        child.stdin.on('error', (e) => this.logger.warn(this.identify(sourceStream), 'in', e));
        child.stdout.on('error', (e) => this.logger.warn(this.identify(sourceStream), 'out', e));
    
        const task = new Promise<AudioMetaInfo>((resolve) => {
            let text = '';
            child.stderr.on('data', data => {
                text += data;
            });
            child.on('close', () => {
                const artistGroups = artistRe.exec(text);
                const artist = artistGroups?.groups?.target?.trim() ?? '';
                
                const titleGroups = titleRe.exec(text);
                const title = titleGroups?.groups?.target?.trim() ?? '';

                let dura: string;
                let duraGroups: RegExpExecArray;
                while ((duraGroups = durationRe.exec(text))) {
                    dura = duraGroups?.groups?.target?.trim() ?? '00:00:00';
                }

                let duration = 0;
                let multiplier = 3600;
                for (const s of dura.split(':')) {
                    duration += parseInt(s) * multiplier;
                    multiplier /= 60;
                }

                const res = new AudioMetaInfo(artist, title, duration);
                this.logger.debug(this.identify(sourceStream), 'Meta:', res);
                
                resolve(res);
            });
        });

        sourceStream.pipe(child.stdin);
        return await task;
    }

    private identify(obj: Readable): number {
        if (!this.identifiers.has(obj)) {
            this.identifiers.set(obj, ++this.identCount);
        }
        return this.identifiers.get(obj);
    }
}

const artistRe = new RegExp('\\s+artist\\s+: (?<target>[^\\n$]+)', 'i');
const titleRe = new RegExp('\\s+title\\s+: (?<target>[^\\n$]+)', 'i');
const durationRe = new RegExp('\\s+(duration: |time=)(?<target>[0-9\\:]+)', 'g');

export default AudioConverter;
