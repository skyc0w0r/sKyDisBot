import Discord from 'discord.js';
import { createReadStream } from 'fs';
import Logger from 'log4js';
import { ConvertAudioForDis } from './ffmpeg.js';

class AudioPlayer {
    private logger: Logger.Logger;
    private voices: Array<Discord.VoiceConnection>;
    constructor() {
        this.logger = Logger.getLogger('audio_player');
        this.voices = [];
    }

    public async dispatch(msg: Discord.Message): Promise<void> {
        try {
            if (msg.content.startsWith('!audio play')) {
                await this.play(msg);
            }
        }
        catch (e) {
            this.logger.warn('Got error, while ...', e);
        }
    }

    private async play(msg: Discord.Message): Promise<void> {
        if (!msg.member?.voice?.channel) {
            msg.channel.send('Join voice first!');
            return;
        }
        const f = createReadStream('ЮГ 404 - НАЙДИ МЕНЯ (2018).mp3');
        const convertedF = ConvertAudioForDis(f);
        const voice = await msg.member?.voice.channel?.join();
        this.voices.push(voice);
        const dp = voice.play(convertedF, { type: 'converted' });
        dp.on('finish', () => {
            voice.disconnect();
            this.voices = this.voices.filter(c => c !== voice);
        });
        // voice.play('15 - Dropout - Handcrafted.flac');
        // ffmpeg -i "15 - Dropout - Handcrafted.flac" -analyzeduration 0 -loglevel 0 -f s16le -ar 48000 -ac 2 pipe:1
    }

    public async shutdown(): Promise<void> {
        for (const voice of this.voices) {
            voice.disconnect();
        }
    }
}

export default AudioPlayer;
