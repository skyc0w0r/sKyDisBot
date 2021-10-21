import Discord from 'discord.js';
import Logger from 'log4js';
import PlayState from '../Enum/PlayState.js';
import AudioYTMessage from '../Model/AudioYTMessage.js';
import { GuildAudioInfo, GuildAudioInfoCollection } from '../Model/GuildAudioInfo.js';
import { ConvertAudioForDis } from './FFmpeg.js';
import YouTubeApi from './YouTubeApi.js';

class AudioPlayer {
    private logger: Logger.Logger;
    private youtubeApi: YouTubeApi;

    private state: GuildAudioInfoCollection;
    constructor(ytApi: YouTubeApi) {
        this.logger = Logger.getLogger('audio_player');
        this.youtubeApi = ytApi;
        this.state = {};
    }

    public async dispatch(msg: Discord.Message): Promise<void> {
        try {
            // if (msg.content.startsWith('!audio play')) {
            //     await this.play(msg);
            // }
            if (msg.content.startsWith('!audio yt')) {
                await this.playYTLink(msg);
            }
            if (msg.content === '!audio skip') {
                await this.skip(msg);
            }
        }
        catch (e) {
            this.logger.warn('Got error, while ...', e);
        }
    }

    public async shutdown(): Promise<void> {
        for (const key of Object.keys(this.state)) {
            const info = this.state[key];
            info.voiceConnection.disconnect();
        }
    }

    // private async play(msg: Discord.Message): Promise<void> {
    //     if (!msg.member?.voice?.channel) {
    //         await msg.channel.send('Join voice first!');
    //         return;
    //     }
    //     const f = createReadStream('ЮГ 404 - НАЙДИ МЕНЯ (2018).mp3');
    //     const convertedF = ConvertAudioForDis(f);
    //     const voice = await msg.member?.voice.channel?.join();
    //     this.voices.push(voice);
    //     const dp = voice.play(convertedF, { type: 'converted' });
    //     dp.on('finish', () => {
    //         voice.disconnect();
    //         this.voices = this.voices.filter(c => c !== voice);
    //     });
    //     // voice.play('15 - Dropout - Handcrafted.flac');
    //     // ffmpeg -i "15 - Dropout - Handcrafted.flac" -analyzeduration 0 -loglevel 0 -f s16le -ar 48000 -ac 2 pipe:1
    // }

    private async playYTLink(msg: Discord.Message): Promise<void> {
        if (!msg.member.voice.channel) {
            await msg.channel.send('Join voice first!');
            return;
        }

        const link = tryGetYTLink(msg.content);
        if (!link) {
            await msg.channel.send('Invalid link');
            return;
        }

        const g = this.getInfo(msg.guild.id);
        g.queue.push(new AudioYTMessage(msg, link));

        this.logger.info('YT added to queue on', msg.guild.id);
        await msg.channel.send('Enqueued 👍');

        this.playStreamTo(msg.guild.id);
    }

    private async skip(msg: Discord.Message): Promise<void> {
        const g = this.getInfo(msg.guild.id);
        if (g.playState !== PlayState.Playing) {
            await msg.channel.send('Nothing playing');
            return;
        }
        this.destroyPlayer(msg.guild.id);
        await msg.channel.send('Skipped 👍');
    }

    private destroyPlayer(guildId: string): void {
        const g = this.getInfo(guildId);
        if (g.playState !== PlayState.Playing) {
            // not playing anything
            return;
        }

        g.destroyer();
        g.voiceDispatch.destroy();
    }

    private async playStreamTo(guildId: string): Promise<void> {
        try {
            const g = this.getInfo(guildId);
            // if we are not already playting
            if (g.playState !== PlayState.Stopped) {
                return;
            }
            // if not queue empty
            if (g.queue.length === 0) {
                return;
            }
    
            this.logger.info('Preparing new track for', guildId);
            const audio = g.queue.shift();
            // if the bot was playing in another channel
            await g.joinChannel(audio.msg.member.voice.channel);
    
            if (audio instanceof AudioYTMessage) {
                this.logger.info('Playing ', audio.videoId, 'to', guildId);
                
                const stream = this.youtubeApi.getAudioStream(audio.videoId);
                const [convStream, destroyer] = ConvertAudioForDis(stream);
                convStream.on('error', () => this.destroyPlayer(guildId));

                g.play(convStream, destroyer);
            }
        }
        catch (err) {
            this.logger.warn('Failed to play in', guildId);
        }
    }

    private getInfo(id: string): GuildAudioInfo | null {
        if(!this.state[id]) {
            this.state[id] = new GuildAudioInfo();
            this.state[id].on('finish', () => this.playStreamTo(id));
        }
        return this.state[id];
    }
}

const ytreg = new RegExp('.*(https?://)?(www.)?(youtube\\.com/watch\\?v=|youtu\\.be/)(?<link>[^?&]+)');
function tryGetYTLink(text: string): string | null {
    const ytregres = ytreg.exec(text);
    if (ytregres && ytregres.groups && ytregres.groups['link']) {
        return ytregres.groups['link'];
    }
    return null;
}

export default AudioPlayer;
