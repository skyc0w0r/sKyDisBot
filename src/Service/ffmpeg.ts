import { spawn, spawnSync } from 'child_process';
import Logger from 'log4js';
import { PassThrough, Readable } from 'stream';

let ffmpegCmd: string;
let logger: Logger.Logger | undefined = undefined;
function findFfmpeg() {
    for (const command of ['ffmpeg', 'avconv', './ffmpeg', './avconv', 'ffmpeg.exe', './ffmpeg.exe']) {
        if (!spawnSync(command, ['-h']).error) {
            ffmpegCmd = command;
            break;
        }
    }
    if (!ffmpegCmd) {
        throw new Error('ffmpeg binary not found');
    }
}
findFfmpeg();

function ConvertAudioForDis(stream: Readable): [Readable, () => void] {
    if (!logger) {
        logger = Logger.getLogger('ffmpeg_wrapper');
    }

    const child = spawn(ffmpegCmd, [
        '-i', 'pipe:0',
        '-vn', '-hide_banner',
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-f', 's16le',
        '-ac', '2',
        '-ar', '48000',
        'pipe:1',
    ]);

    stream.on('error', (err) => {
        logger.debug('Could not convert stream', err);
        stream.unpipe();
        pt.emit('error', err);
        cleanup();
    });
    stream.on('end', () => cleanup);

    const cleanup = () => {
        if (!child.killed) {
            child.kill('SIGKILL');
        }
    };

    child.stdin.on('error', (e) => logger.warn('in', e));
    child.stdout.on('error', (e) => logger.warn('out', e));

    stream.pipe(child.stdin);
    const pt = new PassThrough({
        highWaterMark: 128000,
    });
    child.stdout.pipe(pt);
    return [pt, () => {
        stream.unpipe();
        stream.destroy();
        cleanup();
    }];
}

export {
    ConvertAudioForDis,
};
