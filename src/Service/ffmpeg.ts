import { spawn, spawnSync } from 'child_process';
import { PassThrough, Readable } from 'stream';

let ffmpegCmd: string;
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

function ConvertAudioForDis(stream: Readable): Readable {
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
        console.log(`Could not convert stream: ${err}`);
        stream.unpipe();
        child.stdout.emit('error', `Could not convert stream: ${err}`);
        child.kill('SIGKILL');
    });

    stream.pipe(child.stdin);
    // return child.stdout;
    const pt = new PassThrough({
        highWaterMark: 128000,
    });
    child.stdout.pipe(pt);
    return pt;
}

export {
    ConvertAudioForDis,
};
