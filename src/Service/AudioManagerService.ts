import Discord from 'discord.js';
import Logger from 'log4js';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import CommandParserService from './CommandParserService.js';
import { GlobalServiceManager } from './ServiceManager.js';
import AudioConverter from './AudioConverter.js';
import YouTubeService from './YouTubeService.js';
import { GuildAudioPlayerCollection } from '../Model/AudioManager/GuildAudioPlayerCollection.js';
import { GuildAudioPlayer } from '../Class/GuildAudioPlayer.js';
import { CommandCallback } from '../Interface/CommandParserInterface.js';
import human from '../human.js';
import Video from '../Model/YouTube/Video.js';
import { YouTubeTrack, WebTrack, AudioTrack } from '../Model/AudioManager/index.js';
import WebLoader from './WebLoader.js';

class AudioManagerService extends BaseService {
    private audioConverter: AudioConverter;
    private youtube: YouTubeService;
    private webLoader: WebLoader;
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
            throw new Error('Where is my AudioConverter?');
        }
        this.youtube = GlobalServiceManager().GetService(YouTubeService);
        if (!this.youtube) {
            throw new Error('Where is my YouTube?');
        }
        this.webLoader = GlobalServiceManager().GetService(WebLoader);
        if (!this.webLoader) {
            throw new Error('Where is my WebLoader?');
        }
        cp = cp.RegisterCategory('audio', (c, i) => this.wrapper(c, i), 'Audio player commands');
        cp.RegisterCommand('play', (c) => this.playYTLink(c), {
            description: 'Play video/playlist from youtube. Also search&select first result',
            options: [
                {
                    id: 'link',
                    description: 'Link for youtube video/Search query',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('direct', (c) => this.playDirectLink(c), {
            description: 'Plays audio file from web link',
            options: [
                {
                    id: 'url',
                    description: 'DIRECT url for audio file',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand(['search', 'find'], (c) => this.playSearch(c), {
            description: 'Search and select video from youtube',
            options: [
                {
                    id: 'query',
                    description: 'What to search for',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('pause', (c) => this.pause(c), {description: 'Pauses and unpauses player'});
        cp.RegisterCommand('leave', (c) => this.leave(c), {description: 'Disconnect from voice channel'});
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

    private async playDirectLink(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.voice.channel) {
            await cmd.reply({content: 'Join voice first!'});
            return;
        }
        const p = this.getGuildPlayer(cmd.Guild);
        await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);

        const urlText = cmd.Params['url'].value;
        let url: URL;
        try {
            url = new URL(urlText);
        } catch (e) {
            cmd.reply({content: 'Invalid link 😠'});
            return;
        }
        p.enqueue(this.createWebTrack(cmd, url));

        this.logger.info(human._s(cmd.Guild), `Added direct link track ${''} to queue`);
        await cmd.reply({content: '👍👍👍'});
        return;
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
            // search and play first
            // await cmd.reply({content: 'Invalid link'});
            const searchres = await this.youtube.search(cmd.Params['link'].value);
            if (searchres.length === 0) {
                await cmd.reply({content: 'No results'});
                return;
            }            
            p.enqueue(this.createYTReadable(cmd, searchres[0]));

            this.logger.info(human._s(cmd.Guild), `Added youtube track (id: ${searchres[0].Id}) to queue`);
            await cmd.reply({content: this.displayYTvid(searchres[0])});
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

            this.logger.info(human._s(cmd.Guild), `Added youtube track (id: ${vid.Id}) to queue`);
            await cmd.reply({content: this.displayYTvid(vid)});
        }
    }

    // audio search
    private async playSearch(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.voice.channel) {
            await cmd.reply({content: 'Join voice first!'});
            return;
        }
        const p = this.getGuildPlayer(cmd.Guild);
        await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);

        const q = cmd.Params['query'].value;
        const searchResults = await this.youtube.search(q);
        if (searchResults.length === 0) {
            await cmd.reply({content: 'No results'});
            return;
        }
        
        const selected = await cmd.CreateSelectPromt(
            searchResults.filter(
                (_, i) => i < 10).map(c => `${c.Snippet.Title} ${human.time(c.ContentDetails.Duration)}`
            ), (u, c) => u.id === cmd.User.id && c.id === cmd.Channel.id
        );

        if (selected === 'cancel' || selected === 'timeout') {
            return;
        }

        const vid = searchResults[selected - 1];
        p.enqueue(this.createYTReadable(cmd, vid));

        this.logger.info(human._s(cmd.Guild), `Added youtube track (id: ${vid.Id}) to queue`);
        await cmd.reply({content: this.displayYTvid(vid)});
    }
    
    private async notifyError(track: AudioTrack) {
        await track.Origin.reply({content: 'Failed to play the song, try again'});
    }

    // audio pause
    private async pause(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        
        if (p.togglePause()) {
            await cmd.reply({content: '(Un)Paused 👍'});
        } else {
            await cmd.reply({content: 'Nothing playing/Nothing to play 💤'});
        }
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
            let perc = g.PlayDuration / g.Current.Video.ContentDetails.Duration;
            perc = Math.floor(perc * 30);
            const begin = ''.padStart(perc, '=');
            const end = ''.padStart(30 - perc - 1, '=');
            await cmd.reply({
                embeds: [
                    new Discord.MessageEmbed()
                        .setAuthor('Now playing')
                        .setTitle(`**${g.Current.Video.Snippet.Title}**`)
                        .setURL(`https://youtu.be/${g.Current.Video.Id}`)
                        .setThumbnail(g.Current.Video.Snippet.bestThumbnail.Url)
                        .addField(`${human.time(g.PlayDuration)}/${human.time(g.Current.Video.ContentDetails.Duration)}`, `\`\`\`[${begin}O${end}]\`\`\``)
                        .addField('Channel', g.Current.Video.Snippet.ChannelTitle, true)
                        .addField('Requested by', g.Current.Origin.User.nickname, true)
                        .setColor('#FF3DCD')
                ]
            });
        } else if (g.Current.isWebTrack()) {
            let perc = g.PlayDuration / (g.Current.Duration || Infinity);
            perc = Math.floor(perc * 30);
            const begin = ''.padStart(perc, '=');
            const end = ''.padStart(30 - perc - 1, '=');
            await cmd.reply({
                embeds: [
                    new Discord.MessageEmbed()
                        .setAuthor('Now playing')
                        .setTitle(`**${g.Current.Title}**`)
                        .setURL(g.Current.Url.toString())
                        .addField(`${human.time(g.PlayDuration)}/${human.time(g.Current.Duration)}`, `\`\`\`[${begin}O${end}]\`\`\``)
                        .addField('Requested by', g.Current.Origin.User.nickname, true)
                        .setColor('#FF3DCD')
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
            .setColor('#FF3DCD')
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
        return new YouTubeTrack(cmd, video, this.youtube, this.audioConverter);
    };

    createWebTrack = (cmd: BaseCommand, url: URL): WebTrack => {
        return new WebTrack(cmd, url, this.webLoader, this.audioConverter);
    };

    displayYTvid = (vid: Video): string => {
        return `Added **${vid.Snippet.Title}** to the queue!`;
    };

    private getGuildPlayer(guild: Discord.Guild): GuildAudioPlayer {
        if(!this.players[guild.id]) {
            const p = new GuildAudioPlayer(guild);
            p.on('trackError', (t) => this.notifyError(t));
            this.players[guild.id] = p;
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
