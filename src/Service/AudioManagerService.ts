import Discord from 'discord.js';
import { createReadStream } from 'fs';
import Logger from 'log4js';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import CommandParserService from './CommandParserService.js';
import { GlobalServiceManager } from './ServiceManager.js';
import AudioConverter from './AudioConverter.js';
import YouTubeService from './YouTubeService.js';
import { GuildAudioPlayerCollection } from '../Model/AudioManager/GuildAudioPlayerCollection.js';
import GuildAudioPlayer from '../Class/GuildAudioPlayer.js';
import { CommandCallback } from '../Interface/CommandParserInterface.js';
import human from '../human.js';
import AudioConvertionInfo from '../Model/AudioConverter/AudioConvertionInfo.js';
import Video from '../Model/YouTube/Video.js';
import { TestTrack, YouTubeTrack } from '../Model/AudioManager/index.js';

class AudioManagerService extends BaseService {
    private audioConverter: AudioConverter;
    private youtube: YouTubeService;
    private logger: Logger.Logger;
    private players: GuildAudioPlayerCollection;
    constructor() {
        super();
        this.logger = Logger.getLogger('audio_manager');
        this.players = {};
    }

    public Init(): void {
        let cp = GlobalServiceManager().GetService(CommandParserService);
        if (!cp) {
            throw new Error('Where is my CommandParser?');
        }
        this.audioConverter = GlobalServiceManager().GetService(AudioConverter);
        if (!this.audioConverter) {
            throw new Error('Where is my AudioConverter');
        }
        this.youtube = GlobalServiceManager().GetService(YouTubeService);
        if (!this.youtube) {
            throw new Error('Where is my YouTube');
        }
        cp = cp.RegisterCategory('audio', (c, i) => this.wrapper(c, i), 'Audio player commands');
        cp.RegisterCommand('play', (c) => this.playYTLink(c), {
            description: 'play song',
            options: [
                {
                    id: 'link',
                    description: 'Link for youtube video',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('leave', (c) => this.leave(c), {description: 'leave voice'});
        cp.RegisterCommand('skip', (c) => this.skip(c), {description: 'Skips current playing track'});
        cp.RegisterCommand('np', (c) => this.currentPlaying(c), {description: 'Shows currently playing track'});
        cp.RegisterCommand('queue', (c) => this.printQueue(c), {description: 'Shows track queue'});
        cp.RegisterCommand('summon', (c) => this.summon(c), {description: '(Re)Joins voice channel'});
        cp.RegisterAlias('p', 'audio play');
        cp.RegisterAlias('s', 'audio skip');
        cp.RegisterAlias('q', 'audio queue');
    }
    public Destroy(): void {
        Object.keys(this.players).map(c => this.players[c].leaveVoice());
    }
    

    private async wrapper(cmd: BaseCommand, callback: CommandCallback): Promise<void> {
        try {
            if (!cmd.Guild || !cmd.User) {
                return;
            }
            await callback(cmd);
        }
        catch (e) {
            await cmd.Channel.send('Something went wrong, try again later');
            this.logger.warn(human._s(cmd), 'Got error, while processing message', e);
        }
    }

    private async play(cmd: BaseCommand): Promise<void> {
        if (!(cmd.User instanceof Discord.GuildMember)) {
            return;
        }

        if (!cmd.User.voice.channel) {
            await cmd.reply({content: 'Join voice first!'});
            return;
        }
        
        const s = createReadStream('ЮГ 404 - НАЙДИ МЕНЯ (2018).mp3');
        // const s = this.youtube.getAudioStream('https://www.youtube.com/watch?v=Dkuo54HaYCM');
        const cs = this.audioConverter.convertForDis(s);
        const p = this.getGuildPlayer(cmd.Guild);
        await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);
        p.enqueue(new TestTrack(() => cs.outStream));

        await cmd.reply({content: 'Enqueued 👍'});
    }

    // audio play
    private async playYTLink(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.voice.channel) {
            await cmd.reply({content: 'Join voice first!'});
            return;
        }
        const p = this.getGuildPlayer(cmd.Guild);
        await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);

        const link = parseYTLink(cmd.Params['link'].value);
        if (!link || link.type === 'invalid') {
            await cmd.reply({content: 'Invalid link'});
            return;
        }
        if (link.type === 'playlist') {
            // enqueue all songs from playlist
            const items = await this.youtube.getPlaylist(link.list);
            for (const vid of items) {
                // enqueue song by id
                p.enqueue(this.createYTReadable(cmd, vid));
            }

            this.logger.info(human._s(cmd.Guild), `Added youtube playlist (${items.length} items) to queue`);
            await cmd.reply({content: `Enqueued 👍\nSongs: ${items.length}; total time: ${human.time(items.reduce((sum, c) => sum + c.ContentDetails.Duration, 0))}`});

        } else if (link.type === 'video') {
            // enqueue song by id
            const vid = await this.youtube.getVideoInfo(link.vid);
            p.enqueue(this.createYTReadable(cmd, vid));

            this.logger.info(human._s(cmd.Guild), `Added youtube track (id: ${link.vid}) to queue`);
            await cmd.reply({content: 'Enqueued 👍'});
        }
    }
    
    private async notifyError(cmd: BaseCommand, e: Error) {
        await cmd.reply({content: 'Failed to play the song, try again'});
    }

    // audio skip
    private async skip(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        p.skip();
        await cmd.reply({content: 'Skipped 👍'});
    }

    // audio summon
    private async summon(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.voice.channel) {
            await cmd.reply({content: 'Join voice first!'});
            return;
        }
        const p = this.getGuildPlayer(cmd.Guild);
        await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel, true);

        this.logger.info(human._s(cmd.Guild), 'Joined (another) voice channel', human._s(cmd.User.voice.channel));
        await cmd.reply({content: 'Greetings 👋'});
    }

    // audio leave
    private async leave(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        p.leaveVoice();
        await cmd.reply({content: 'Bye 👋'});
    }
    
    // audio np
    private async currentPlaying(cmd: BaseCommand): Promise<void> {
        const g = this.getGuildPlayer(cmd.Guild);
        if (!g.Current) {
            await cmd.reply({content: 'Nothing playing 😥'});
            return;
        }
        if (g.Current.isYouTubeTrack()) {
            await cmd.reply({
                embeds: [
                    new Discord.MessageEmbed()
                        .setAuthor(g.Current.Video.Snippet.Title, undefined, `https://youtu.be/${g.Current.Video.Id}`)
                        .setThumbnail(g.Current.Video.Snippet.bestThumbnail.Url)
                        .addField('Channel', g.Current.Video.Snippet.ChannelTitle)
                        .addField('Duration', human.time(g.Current.Video.ContentDetails.Duration))
                ]
            });
        } else {
            await cmd.reply({content: 'I dunno whats playing'});
        }
    }

    // audio queue
    private async printQueue(cmd: BaseCommand): Promise<void> {
        const g = this.getGuildPlayer(cmd.Guild);

        if (g.Queue.length === 0) {
            await cmd.reply({content: 'Nothing in queue 🥺'});
            return;
        }
        
        const e = new Discord.MessageEmbed()
            .setTitle(`Queue for ${cmd.Guild.name}`)
            .setFooter(`Total: ${g.Queue.length} songs | Duration: ${human.time(g.Queue.reduce((sum, c) => sum + (c.isYouTubeTrack() && c.Video.ContentDetails.Duration || 0), 0))}`);
        
        let nowText = '';
        if (g.Current.isYouTubeTrack()) {
            nowText = `[${g.Current.Video.Snippet.Title}](https://youtu.be/${g.Current.Video.Id}) | ${human.time(g.Current.Video.ContentDetails.Duration)}`;
        } else {
            nowText = 'I dont know what is it';
        }
        let index = 1;
        let queueText = '';
        for (const track of g.Queue.filter((_, i) => i <= 10)) {
            if (track.isYouTubeTrack()) {
                queueText += `${index++}. [${track.Video.Snippet.Title}](https://youtu.be/${track.Video.Id}) | ${human.time(track.Video.ContentDetails.Duration)}\n`;
            } else {
                queueText += `${index++}. I dont know what is it\n`;
            }
        }
        e.addField('Now playing', nowText);
        e.addField('Up next', queueText);
        await cmd.reply({
            embeds: [e]
        });
    }

    createYTReadable = (cmd: BaseCommand, video: Video): YouTubeTrack => {
        let info: AudioConvertionInfo;
        const errHandler = (e: Error) => {
            this.logger.warn('Track fail', e.name, e.message);
            this.notifyError(cmd, e);
        };
        return new YouTubeTrack(video, () => {
            const stream = this.youtube.getAudioStream(video.Id);
            info = this.audioConverter.convertForDis(stream);
            info.outStream.on('error', errHandler);
            return info.outStream;
        }, () => {
            if (info) {
                this.audioConverter.abortConvertion(info);
            }
        }, () => {
            if (info) {
                info.outStream.removeListener('error', errHandler);
            }
        });
    };

    private getGuildPlayer(guild: Discord.Guild): GuildAudioPlayer {
        if(!this.players[guild.id]) {
            this.players[guild.id] = new GuildAudioPlayer(guild);
        }
        return this.players[guild.id];
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
    return {
        type: (list && 'playlist') || (vid && 'video') || 'invalid',
        list,
        vid,
    };
}

interface YTLinkType {
    type: 'video' | 'playlist' | 'invalid'
    list: string | null
    vid: string
}

export default AudioManagerService;
