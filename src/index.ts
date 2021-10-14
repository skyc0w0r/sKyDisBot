import { spawn, spawnSync } from 'child_process';
import Discord from 'discord.js';
import { createReadStream } from 'fs';
import proccess from 'process';
import { PassThrough, Readable } from 'stream';
import config from './config.js';

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



async function play(msg: Discord.Message) {
    if (!msg.member?.voice?.channel) {
        msg.channel.send('Join voice first!');
        return;
    }
    const f = createReadStream('ЮГ 404 - НАЙДИ МЕНЯ (2018).mp3');
    const convertedF = ConvertAudioForDis(f);
    const voice = await msg.member?.voice.channel?.join();
    const dp = voice.play(convertedF, { type: 'converted' });
    // voice.play('15 - Dropout - Handcrafted.flac');
    // ffmpeg -i "15 - Dropout - Handcrafted.flac" -analyzeduration 0 -loglevel 0 -f s16le -ar 48000 -ac 2 pipe:1
}

async function main() {
    config.check();
    
    const cl = new Discord.Client();

    cl.on('ready', () => {
        console.log('Discord client ready');
    });
    
    cl.on('debug', (msg: string) => {
        console.log('[Discord]', msg);
    });
    
    cl.on('message', (msg: Discord.Message) => {
        if (msg.content == 'foo') {
            play(msg);
        }
    });
    
    const res = await cl.login(config.get().DIS_TOKEN);
    console.log(res);
    
    proccess.on('SIGINT', async () => {
        cl.destroy();
    });
}

main();
