import { spawn, spawnSync } from 'child_process';
import Logger from 'log4js';
import { PassThrough, Readable } from 'stream';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import AudioConvertionInfo from '../Model/AudioConverter/AudioConvertionInfo.js';

class AudioConverter extends BaseService {
    private logger: Logger.Logger;
    private ffmpegCmd: string | undefined;
    constructor() {
        super();
        this.logger = Logger.getLogger('audio_converter');
    }

    public init(): Promise<void> {
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

    public convertForDis(sourceStream: Readable): AudioConvertionInfo {
        if (!this.convertForDis) {
            throw new Error('call init() first');
        }
    
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
            this.logger.debug('Could not convert stream', err);
            sourceStream.unpipe();
            pt.emit('error', err);
            this.abortConvertion(res);
        });
        sourceStream.on('end', () => {
            this.logger.debug('sourceStream ended');
        });
        sourceStream.on('close', () => {
            this.logger.debug('sourceStream closed');
            this.abortConvertion(res);
        });
    
        child.stdin.on('error', (e) => this.logger.warn('in', e));
        child.stdout.on('error', (e) => this.logger.warn('out', e));
    
        const pt = new PassThrough({
            highWaterMark: 2 * 1024 * 1024,
        });
        const res = new AudioConvertionInfo(sourceStream, pt, child);

        sourceStream.pipe(child.stdin);
        child.stdout.pipe(pt);

        return res;
    }

    public abortConvertion(info: AudioConvertionInfo): void {
        this.logger.info('Cleaning up streams and killing child', info.proc.pid);
        info.inStream.unpipe();
        info.inStream.destroy();
        if (!info.proc.killed) {
            info.proc.kill('SIGKILL');
        }
    }
}

export default AudioConverter;
