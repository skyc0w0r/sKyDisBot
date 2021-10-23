import Discord from 'discord.js';
import Logger from 'log4js';
import PlayState from '../Enum/PlayState.js';
import human from '../human.js';
import AudioYTMessage from '../Model/AudioYTMessage.js';
import { GuildAudioInfo, GuildAudioInfoCollection } from '../Model/GuildAudioInfo.js';
import AudioConverter from './AudioConverter.js';
import YouTubeApi from './YouTubeApi.js';

class AudioPlayer {
    private logger: Logger.Logger;
    private dsClient: Discord.Client;
    private youtubeApi: YouTubeApi;
    private audioConverter: AudioConverter;

    private state: GuildAudioInfoCollection;
    constructor(ds: Discord.Client, ytApi: YouTubeApi, audConv: AudioConverter) {
        this.logger = Logger.getLogger('audio_player');
        this.dsClient = ds;
        this.youtubeApi = ytApi;
        this.audioConverter = audConv;

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
            if (msg.content.startsWith('!audio find')) {
                await this.findAndPlay(msg);
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

    private async findAndPlay(msg: Discord.Message): Promise<void> {
        if (!msg.member.voice.channel) {
            await msg.channel.send('Join voice first!');
            return;
        }

        const g = this.getInfo(msg.guild.id);

        const q = msg.content.substring('!audio find '.length);
        this.logger.info('Searching in', g.Id, 'for', q);

        const searchResults = await this.youtubeApi.search(q);
        if (searchResults.length === 0) {
            await msg.channel.send('No results');
            return;
        }

        let text = 'Select by entering [1..10]\n```';
        let index = 1;
        for (const video of searchResults) {
            text += `${index++}. ${video.Snippet.Title} ${human.time(video.ContentDetails.Duration)}\n`;
        }
        text += '```';
        const listMsg = await msg.channel.send(text);

        const choice = await new Promise<Discord.Message | 'timeout' | 'cancel'>((resolve) => {
            const promtSelector = (e: Discord.Message): void => {
                if (e.channel.id === msg.channel.id && e.member.id === msg.member.id) {
                    if (msg.content === 'cancel') {
                        resolve('cancel');
                    }
                    const selectedIndex = parseInt(e.content);
                    if (selectedIndex >= searchResults.length || selectedIndex <= 0) {
                        return;
                    }
                    clearTimeout(tm);
                    this.dsClient.removeListener('message', promtSelector);
                    resolve(e);
                }
            };
            const timeOut = () => {
                this.dsClient.removeListener('message', promtSelector);
                resolve('timeout');
            };
            const tm = setTimeout(timeOut, 30*1000);
            this.dsClient.on('message', promtSelector);
        });
        await listMsg.delete();
        if (choice === 'timeout') {
            this.logger.info('Search timed out for', g.Id);
            await msg.channel.send('Timeount');
            return;
        }
        if (choice === 'cancel') {
            this.logger.info('Search canceled for', g.Id);
            await msg.channel.send('Canceled');
            return;
        }
        index = parseInt(choice.content) - 1;
        await choice.delete();

        this.logger.info('Selected for guild', g.Id, ':', searchResults[index].Snippet.Title);
        await msg.channel.send(`Selected #${index+1}: ${searchResults[index].Snippet.Title}`);

        g.queue.push(new AudioYTMessage(msg, searchResults[index].Id));
        await msg.channel.send('Enqueued 👍');

        this.playStreamTo(msg.guild.id);
    }

    private destroyPlayer(guildId: string): void {
        try {    
            const g = this.getInfo(guildId);
            if (g.playState !== PlayState.Playing) {
                // not playing anything
                return;
            }

            this.logger.debug('Destroying player', guildId);
            this.audioConverter.abortConvertion(g.audioInfo);
            g.voiceDispatch.destroy();
        } catch (e) {
            this.logger.error('Failed to destroy player in', guildId, e);
        }
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
                this.logger.info('Playing', audio.videoId, 'to', guildId);
                
                const stream = this.youtubeApi.getAudioStream(audio.videoId);
                const info = this.audioConverter.convertForDis(stream);
                info.outStream.on('error', (e: Error) => {
                    this.destroyPlayer(guildId);
                    this.notifyError(audio.msg, e);
                });

                g.play(info);
            }
        }
        catch (err) {
            this.logger.warn('Failed to play in', guildId);
        }
    }

    private async notifyError(msg: Discord.Message, err: Error): Promise<void> {
        try {
            await msg.channel.send('Failed to play the song');
        } catch (e) {
            this.logger.error('Failed to notify about error', err, 'because another error', e);
        }
    }

    private getInfo(id: string): GuildAudioInfo | null {
        if(!this.state[id]) {
            this.state[id] = new GuildAudioInfo(id);
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
