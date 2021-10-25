import Discord from 'discord.js';
import Logger from 'log4js';
import PlayState from '../Enum/PlayState.js';
import human from '../human.js';
import AudioYTMessage from '../Model/AudioYTMessage.js';
import { CommandCallback } from '../Model/CmdParserModels.js';
import { GuildAudioInfo, GuildAudioInfoCollection } from '../Model/GuildAudioInfo.js';
import AudioConverter from './AudioConverter.js';
import CommandParser from './CommandParser.js';
import YouTubeApi from './YouTubeApi.js';

class AudioPlayer {
    private logger: Logger.Logger;
    private dsClient: Discord.Client;
    private youtubeApi: YouTubeApi;
    private audioConverter: AudioConverter;

    private state: GuildAudioInfoCollection;
    constructor(ds: Discord.Client, parser: CommandParser, ytApi: YouTubeApi, audConv: AudioConverter) {
        this.logger = Logger.getLogger('audio_player');
        this.dsClient = ds;
        
        const audioCategory = parser.RegisterCategory('audio', async (t, m, f) => await this.wrapper(t, m, f));
        audioCategory.RegisterCommand('yt', (t, m) => this.playYTLink(t, m));
        audioCategory.RegisterCommand(['find', 'search'], (t, m) => this.findAndPlay(t, m));
        audioCategory.RegisterCommand('skip', (t, m) => this.skip(m));
        audioCategory.RegisterAlias('p', 'audio yt');

        this.youtubeApi = ytApi;
        this.audioConverter = audConv;

        this.state = {};
    }

    private async wrapper(text: string, msg: Discord.Message, target: CommandCallback): Promise<void> {
        try {
            if (!msg.guild || !msg.member) {
                return;
            }
            await target(text, msg);
        }
        catch (e) {
            await msg.channel.send('Something went wrong, try again later');
            this.logger.warn(human._s(msg.guild), 'Got error, while processing message', e);
        }
    }

    public async shutdown(): Promise<void> {
        await Promise.all(Object.keys(this.state).map(c => this.state[c].leaveChannel()));
    }

    private async playYTLink(text: string, msg: Discord.Message): Promise<void> {
        if (!msg.member.voice.channel) {
            await msg.channel.send('Join voice first!');
            return;
        }
        const g = this.getInfo(msg.guild);
        await g.joinChannel(msg.member.voice.channel);

        const link = parseYTLink(text);
        if (!link) {
            await msg.channel.send('Invalid link');
            return;
        }
        if (link.type === 'playlist') {
            // enqueue all songs from playlist
        } else if (link.type === 'video') {
            // enqueue song by id
            g.queue.push(new AudioYTMessage(msg, link.vid));

            this.logger.info(human._s(g.guild), 'Added youtube track to queue');
            await msg.channel.send('Enqueued 👍');

            this.playStreamTo(msg.guild);
        }
    }

    private async skip(msg: Discord.Message): Promise<void> {
        const g = this.getInfo(msg.guild);
        if (g.playState !== PlayState.Playing) {
            await msg.channel.send('Nothing playing');
            return;
        }
        this.destroyPlayer(msg.guild);
        await msg.channel.send('Skipped 👍');
    }

    private async findAndPlay(q: string, msg: Discord.Message): Promise<void> {
        if (!msg.member.voice.channel) {
            await msg.channel.send('Join voice first!');
            return;
        }
        const g = this.getInfo(msg.guild);

        this.logger.info(human._s(g.guild), 'Searching in for', q);
        await msg.channel.send(`Searching 🔎 **${q}**`);
        
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
                    if (selectedIndex > searchResults.length || selectedIndex <= 0) {
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
            this.logger.info(human._s(g.guild), 'Search timed out');
            await msg.channel.send('Timeount');
            return;
        }
        if (choice === 'cancel') {
            this.logger.info(human._s(g.guild), 'Search canceled');
            await msg.channel.send('Canceled');
            return;
        }
        index = parseInt(choice.content) - 1;
        await choice.delete();

        this.logger.info(human._s(g.guild), 'Selected', human._s(searchResults[index]));
        await msg.channel.send(`Selected #${index+1}: ${searchResults[index].Snippet.Title}`);

        g.queue.push(new AudioYTMessage(msg, searchResults[index].Id));
        await msg.channel.send('Enqueued 👍');

        this.playStreamTo(msg.guild);
    }

    private destroyPlayer(guild: Discord.Guild): void {
        try {    
            const g = this.getInfo(guild);
            if (g.playState !== PlayState.Playing) {
                // not playing anything
                return;
            }

            this.logger.debug(human._s(guild), 'Destroying player');
            this.audioConverter.abortConvertion(g.audioInfo);
            g.voiceDispatch.destroy();
        } catch (e) {
            this.logger.error(human._s(guild), 'Failed to destroy player in', e);
        }
    }

    private async playStreamTo(guild: Discord.Guild): Promise<void> {
        try {
            const g = this.getInfo(guild);
            // if we are not already playting
            if (g.playState !== PlayState.Stopped) {
                return;
            }
            // if not queue empty
            if (g.queue.length === 0) {
                return;
            }
    
            this.logger.info(human._s(guild), 'Preparing new track');
            const audio = g.queue.shift();

            // if the bot was playing in another channel
            await g.joinChannel(audio?.msg.member?.voice.channel);
    
            if (audio instanceof AudioYTMessage) {
                this.logger.info(human._s(guild), 'Playing', audio.videoId);
                
                const stream = this.youtubeApi.getAudioStream(audio.videoId);
                const info = this.audioConverter.convertForDis(stream);
                info.outStream.on('error', (e: Error) => {
                    this.destroyPlayer(guild);
                    this.notifyError(audio.msg, e);
                });

                g.play(info);
            }
        }
        catch (err) {
            this.logger.warn(human._s(guild), 'Failed to play');
        }
    }

    private async notifyError(msg: Discord.Message, err: Error): Promise<void> {
        try {
            await msg.channel.send('Failed to play the song');
        } catch (e) {
            this.logger.error('Failed to notify about error', err, 'because another error', e);
        }
    }

    private getInfo(guild: Discord.Guild): GuildAudioInfo {
        if(!this.state[guild.id]) {
            this.state[guild.id] = new GuildAudioInfo(guild);
            this.state[guild.id].on('finish', () => this.playStreamTo(guild));
        }
        return this.state[guild.id];
    }
}

function parseYTLink(text: string): YTLinkType | null {
    let list: string | null = null;
    let vid: string | null = null;
    try {
        const u = new URL(text);
        if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
            list = u.searchParams.get('list');
            vid = u.searchParams.get('v');
        }
        else if (u.hostname === 'youtu.be') {
            list = u.searchParams.get('list');
            vid = u.pathname.substring(1);
        }
    } catch {
        // whatever
    }
    if (vid) {
        return {
            type: list && 'playlist' || 'video',
            list,
            vid,
        };
    }
    return null;
}

interface YTLinkType {
    type: 'video' | 'playlist'
    list: string | null
    vid: string
}

export default AudioPlayer;
