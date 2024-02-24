import Discord, { EmbedBuilder } from 'discord.js';
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
import { LastTrackCollection } from '../Model/AudioManager/LastTrackCollection.js';
import { LoopMode } from '../Interface/LoopMode.js';
import YandexService from './YandexService.js';
import { YandexTrack } from '../Model/AudioManager/YandexTrack.js';
import Track from '../Model/Yandex/Track.js';
import { ActualTextChannel } from '../Interface/Util.js';

class AudioManagerService extends BaseService {
    private audioConverter: AudioConverter;
    private youtube: YouTubeService;
    private ym: YandexService;
    private webLoader: WebLoader;
    private logger: Logger.Logger;
    private players: GuildAudioPlayerCollection;
    private lastTracks: LastTrackCollection;

    constructor() {
        super();
        this.logger = Logger.getLogger('audio_manager');
        this.players = {};
        this.lastTracks = {};
    }

    public Init(): void {
        let cp = GlobalServiceManager().GetRequiredService(CommandParserService);
        this.audioConverter = GlobalServiceManager().GetRequiredService(AudioConverter);
        this.youtube = GlobalServiceManager().GetRequiredService(YouTubeService);
        this.ym = GlobalServiceManager().GetRequiredService(YandexService);
        this.webLoader = GlobalServiceManager().GetRequiredService(WebLoader);

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
        cp.RegisterCommand('playtop', (c) => this.playYTLink(c, true), {
            description: '[Queue top]Play video/playlist from youtube. Also search&select first result',
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
        cp.RegisterCommand('directtop', (c) => this.playDirectLink(c, true), {
            description: '[Queue top]Plays audio file from web link',
            options: [
                {
                    id: 'url',
                    description: 'DIRECT url for audio file',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('ym', (c) => this.playYandexMusicLink(c), {
            description: 'Plays audio from yandex.music service',
            options: [
                {
                    id: 'url',
                    description: 'Track url',
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
        cp.RegisterCommand('yms', (c) => this.playYandexMusicSearch(c), {
            description: 'Search and select video from yandex.music',
            options: [
                {
                    id: 'query',
                    description: 'What to search for',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('loop', (c) => this.toggleLoop(c), {
            options: [
                {
                    id: 'mode',
                    description: 'Loop mode',
                    required: true,
                    choices: ['none', 'one', 'all'],
                }
            ]
        });
        cp.RegisterCommand('last', (c) => this.playLast(c), { description: 'Adds last track to queue' });
        cp.RegisterCommand('pause', (c) => this.pause(c), { description: 'Pauses and unpauses player' });
        cp.RegisterCommand('leave', (c) => this.leave(c), { description: 'Disconnect from voice channel' });
        cp.RegisterCommand('skip', (c) => this.skip(c), {
            description: 'Skips current playing track or n next tracks',
            options: [
                {
                    description: 'Number of tracks to skip',
                    id: 'n',
                    required: false
                }
            ]
        });
        cp.RegisterCommand('np', (c) => this.currentPlaying(c), { description: 'Shows currently playing track' });
        cp.RegisterCommand('queue', (c) => this.printQueue(c), { description: 'Shows track queue' });
        cp.RegisterCommand('summon', (c) => this.summon(c), { description: '(Re)Joins voice channel' });
        cp.RegisterAlias('p', 'audio play');
        cp.RegisterAlias('pt', 'audio playtop');
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
            await (cmd.Channel as ActualTextChannel).send('Something went wrong, try again later');
            this.logger.warn(human._s(cmd), 'Got error, while processing message', e);
        }
    }

    // audio ym 
    private async playYandexMusicLink(cmd: BaseCommand, isTop = false): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        if (!p.Channel) {
            if (!cmd.User.voice.channel) {
                await cmd.reply({ content: 'Join voice first!' });
                return;
            } else {
                await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);
            }
        }

        const link = parseYMLink(cmd.Params['url'].value);
        if (link.type === 'invalid') {
            const searchres = await this.ym.SearchTrack(cmd.Params['link'].value);
            if (searchres.length === 0) {
                await cmd.reply({ content: 'No results' });
                return;
            }
            const track = new YandexTrack(cmd, searchres[0], this.ym, this.audioConverter);
            p.enqueue(track, isTop);
            this.setLastTrack(cmd.User, track);

            this.logger.info(human._s(cmd.Guild), `Added yandex.music track (id: ${searchres[0].Id}) to queue`);
            await cmd.reply(this.displayYMTrack(searchres[0]));
        } else if (link.type === 'track') {
            const info = await this.ym.GetTrackInfo(link.track);
            const track = new YandexTrack(cmd, info, this.ym, this.audioConverter);

            p.enqueue(track, isTop);
            this.setLastTrack(cmd.User, track);

            this.logger.info(human._s(cmd.Guild), `Added yandex.music track (id: ${info.Id}) to queue`);
            await cmd.reply(this.displayYMTrack(info));
        } else if (link.type === 'playlist') {
            const playlist = await this.ym.GetPlaylist(link.user, link.playlist);
            for (const item of playlist.Tracks) {
                p.enqueue(new YandexTrack(cmd, item.Track, this.ym, this.audioConverter), isTop);
            }
            
            this.logger.info(human._s(cmd.Guild), `Added yandex.music playlist (${playlist.TrackCount} items) to queue`);
            await cmd.reply({ content: `Enqueued **${playlist.Title}** 👍\nSongs: **${playlist.TrackCount}**; Total duration: **${human.timeSpan(playlist.Duration)}**` });
        } else if (link.type === 'album') {
            const album = await this.ym.GetAlbum(link.album);
            for (const item of album.Tracks) {
                p.enqueue(new YandexTrack(cmd, item, this.ym, this.audioConverter), isTop);
            }

            this.logger.info(human._s(cmd.Guild), `Added yandex.music album (${album.TrackCount} items) to queue`);
            await cmd.reply({ content: `Enqueued **${album.Title}** 👍\nSongs: ${album.TrackCount}; total time: ${human.timeSpan(album.Tracks.reduce((total, x) => total + x.Duration, 0))}` });
        }
    }

    // audio direct
    private async playDirectLink(cmd: BaseCommand, isTop = false): Promise<void> {
        if (!cmd.User.voice.channel) {
            await cmd.reply({ content: 'Join voice first!' });
            return;
        }
        const p = this.getGuildPlayer(cmd.Guild);
        await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);

        const urlText = cmd.Params['url'].value;
        let url: URL;
        try {
            url = new URL(urlText);
        } catch (e) {
            cmd.reply({ content: 'Invalid link 😠' });
            return;
        }
        const track = new WebTrack(cmd, url, this.webLoader, this.audioConverter);
        p.enqueue(track, isTop);
        this.setLastTrack(cmd.User, track);

        this.logger.info(human._s(cmd.Guild), `Added direct link track ${track.Url.toString()} to queue`);
        await cmd.reply(this.displayDirectTrack(track));
    }

    // audio play
    private async playYTLink(cmd: BaseCommand, isTop = false): Promise<void> {
        if (!cmd.User.voice.channel) {
            await cmd.reply({ content: 'Join voice first!' });
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
                await cmd.reply({ content: 'No results' });
                return;
            }
            const track = new YouTubeTrack(cmd, searchres[0], this.youtube, this.audioConverter);
            p.enqueue(track, isTop);
            this.setLastTrack(cmd.User, track);

            this.logger.info(human._s(cmd.Guild), `Added youtube track (id: ${searchres[0].Id}) to queue`);
            await cmd.reply(this.displayYTtrack(searchres[0]));
        } else if (link.type === 'playlist') {
            // enqueue all songs from playlist
            const items = await this.youtube.getPlaylist(link.list);
            for (const vid of items) {
                // enqueue song by id
                p.enqueue(new YouTubeTrack(cmd, vid, this.youtube, this.audioConverter), isTop);
            }

            this.logger.info(human._s(cmd.Guild), `Added youtube playlist (${items.length} items) to queue`);
            await cmd.reply({ content: `Enqueued 👍\nSongs: ${items.length}; total time: ${human.timeSpan(items.reduce((sum, c) => sum + c.ContentDetails.Duration, 0))}` });
        } else if (link.type === 'video') {
            // enqueue song by id
            const vid = await this.youtube.getVideoInfo(link.vid);
            const track = new YouTubeTrack(cmd, vid, this.youtube, this.audioConverter);
            p.enqueue(track, isTop);
            this.setLastTrack(cmd.User, track);

            this.logger.info(human._s(cmd.Guild), `Added youtube track (id: ${vid.Id}) to queue`);
            await cmd.reply(this.displayYTtrack(vid));
        }
    }

    // audio last
    private async playLast(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.voice.channel) {
            await cmd.reply({ content: 'Join voice first!' });
            return;
        }
        const p = this.getGuildPlayer(cmd.Guild);
        await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);

        const track = this.getLastTrack(cmd.User);
        if (!track) {
            await cmd.reply({ content: 'You havent played anything yet 💫' });
            return;
        }

        p.enqueue(track);
        if (track.isYouTubeTrack()) {
            await cmd.reply(this.displayYTtrack(track.Video));
        } else if (track.isWebTrack()) {
            await cmd.reply(this.displayDirectTrack(track));
        } else {
            await cmd.reply({ content: 'Unkown track type' });
        }
    }

    // audio search
    private async playSearch(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        if (!p.Channel) {
            if (!cmd.User.voice.channel) {
                await cmd.reply({ content: 'Join voice first!' });
                return;
            } else {
                await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);
                this.logger.debug(human._s(cmd.Guild), 'Joined voice channel', human._s(p.Channel));
            }
        } else {
            this.logger.debug(human._s(cmd.Guild), 'Current voice channel', human._s(p.Channel));
        }

        const q = cmd.Params['query'].value;
        const searchResults = await this.youtube.search(q);
        if (searchResults.length === 0) {
            await cmd.reply({ content: 'No results' });
            return;
        }

        const selected = await cmd.CreateSelectPromt(
            searchResults
                .filter((_, i) => i < 10)
                .map(c => `${c.Snippet.Title} ${human.timeSpan(c.ContentDetails.Duration)}`),
            (u, c) => u.id === cmd.User.id && c.id === cmd.Channel.id
        );

        if (selected === 'cancel' || selected === 'timeout') {
            return;
        }

        const vid = searchResults[selected - 1];
        const track = new YouTubeTrack(cmd, vid, this.youtube, this.audioConverter);
        p.enqueue(track);
        this.setLastTrack(cmd.User, track);

        this.logger.info(human._s(cmd.Guild), `Added youtube track (id: ${vid.Id}) to queue`);
        await cmd.reply(this.displayYTtrack(vid));
    }

    // audio ysm
    private async playYandexMusicSearch(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        if (!p.Channel) {
            if (!cmd.User.voice.channel) {
                await cmd.reply({ content: 'Join voice first!' });
                return;
            } else {
                await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);
            }
        }

        const q = cmd.Params['query'].value;
        const searchResults = await this.ym.SearchTrack(q);
        if (searchResults.length === 0) {
            await cmd.reply({ content: 'No results' });
            return;
        }

        const selected = await cmd.CreateSelectPromt(
            searchResults
                .filter((_, i) => i < 10)
                .map(c => `${c.Artists[0].Name} - ${c.Title} ${human.timeSpan(c.Duration)}`),
            (u, c) => u.id === cmd.User.id && c.id === cmd.Channel.id
        );

        if (selected === 'cancel' || selected === 'timeout') {
            return;
        }

        const info = searchResults[selected - 1];
        const track = new YandexTrack(cmd, info, this.ym, this.audioConverter);
        p.enqueue(track);
        this.setLastTrack(cmd.User, track);

        this.logger.info(human._s(cmd.Guild), `Added yandex.music track (id: ${info.Id}) to queue`);
        await cmd.reply(this.displayYMTrack(info));
    }

    private async notifyError(track: AudioTrack) {
        await track.Origin.reply({ content: `Failed to play **${track.Title}**, try again` });
    }

    // audio pause
    private async pause(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);

        if (p.togglePause()) {
            await cmd.reply({ content: '(Un)Paused 👍' });
        } else {
            await cmd.reply({ content: 'Nothing playing/Nothing to play 💤' });
        }
    }

    // audio loop
    private async toggleLoop(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);

        const mode = cmd.Params['mode'].value;

        if (p.toggleLoop(mode as LoopMode)) {
            await cmd.reply({ content: `Loop mode set to **${mode}**` });
        } else {
            await cmd.reply({ content: 'Nothing playing/Nothing to play 💤' });
        }
    }

    // audio skip
    private async skip(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        let skipCount = 1;
        const param = cmd.Params['n'];
        if (param) {
            try {
                skipCount = parseInt(param.value);
            }
            catch (e) {
                // whatever
            }
        }
        p.skip(skipCount);
        await cmd.reply({ content: 'Skipped 👍' });
    }

    // audio summon
    private async summon(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.voice.channel) {
            await cmd.reply({ content: 'Join voice first!' });
            return;
        }
        const p = this.getGuildPlayer(cmd.Guild);
        await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel, true);

        this.logger.info(human._s(cmd.Guild), 'Joined (another) voice channel', human._s(cmd.User.voice.channel));
        await cmd.reply({ content: 'Greetings 👋' });
    }

    // audio leave
    private async leave(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        p.leaveVoice();
        await cmd.reply({ content: 'Bye 👋' });
    }

    // audio np
    private async currentPlaying(cmd: BaseCommand): Promise<void> {
        const g = this.getGuildPlayer(cmd.Guild);
        if (!g.Current) {
            await cmd.reply({ content: 'Nothing playing 😥' });
            return;
        }

        let perc = g.PlayDuration / (g.Current.Duration || Infinity);
        perc = Math.floor(perc * 30);
        const begin = ''.padStart(perc, '=');
        const end = ''.padStart(30 - perc - 1, '=');
        const emb = new EmbedBuilder()
            .setAuthor({ name: 'Now playing' })
            .setTitle(`**${g.Current.Title}**`)
            .addFields({
                name: `${human.timeSpan(g.PlayDuration)}/${human.timeSpan(g.Current.Duration)}`,
                value: `\`\`\`[${begin}O${end}]\`\`\``,
            }, {
                name: 'Requested by',
                value: g.Current.Origin.User.nickname,
                inline: true,
            });

        if (g.Current.isYouTubeTrack()) {
            emb.setURL(`https://youtu.be/${g.Current.Video.Id}`)
                .setThumbnail(g.Current.Video.Snippet.bestThumbnail.Url)
                .addFields({
                    name: 'Channel',
                    value: g.Current.Video.Snippet.ChannelTitle,
                    inline: true,
                }).setColor('#FF3DCD');
        } else if (g.Current.isWebTrack()) {
            emb.setURL(g.Current.Url.toString())
                .setColor('#FF3DCD');
        } else if (g.Current.isYandexMusicTrack()) {
            emb
            .setThumbnail(g.Current.Track.CoverUri.replace('%%', '200x200'))
            .addFields({
                name: 'Artist(s)',
                value: g.Current.Track.Artists.map(x => x.Name).join(' & '),
                inline: true,
            }).setColor('#FED42B');
        } else {
            await cmd.reply({ content: 'I dunno whats playing' });
            return;
        }

        await cmd.reply({ embeds: [emb] });
    }

    // audio queue
    private async printQueue(cmd: BaseCommand): Promise<void> {
        const g = this.getGuildPlayer(cmd.Guild);

        if (g.Queue.length === 0) {
            await cmd.reply({ content: 'Nothing in queue 🥺' });
            return;
        }

        const loopToEmoji = {
            'none': '➡',
            'one': '🔂',
            'all': '🔁',
        };

        const e = new EmbedBuilder()
            .setTitle(`Queue for ${cmd.Guild.name}`)
            .setDescription(`Loop: ${loopToEmoji[g.LoopMode]}`)
            .setColor('#FF3DCD')
            .setFooter({
                text: `Total: ${g.Queue.length} songs | Duration: ${human.timeSpan(g.Queue.reduce((sum, c) => sum + c.Duration, 0))}`
            });

        let nowText = '';
        if (g.Current.isYouTubeTrack()) {
            nowText = `[${g.Current.Title}](https://youtu.be/${g.Current.Video.Id}) | ${human.timeSpan(g.Current.Duration)}`;
        } else if (g.Current.isWebTrack()) {
            nowText = `[${g.Current.Title}](${g.Current.Url.toString()}) | ${human.timeSpan(g.Current.Duration)}`;
        } else if (g.Current.isYandexMusicTrack()) {
            nowText = `[${g.Current.Title}](https://music.yandex.com) | ${human.timeSpan(g.Current.Duration)}`;
        } else {
            nowText = 'I dont know what is it';
        }
        let index = 1;
        let queueText = '';
        for (const track of g.Queue.filter((_, i) => i <= 10)) {
            if (track.isYouTubeTrack()) {
                queueText += `${index++}. [${track.Video.Snippet.Title}](https://youtu.be/${track.Video.Id}) | ${human.timeSpan(track.Video.ContentDetails.Duration)}\n`;
            } else if (track.isWebTrack()) {
                queueText += `${index++}. [${track.Title}](${track.Url.toString()}) | ${human.timeSpan(track.Duration)}\n`;
            } else if (g.Current.isYandexMusicTrack()) {
                queueText += `[${g.Current.Title}](https://music.yandex.com) | ${human.timeSpan(g.Current.Duration)}\n`;
            } else {
                queueText += `${index++}. I dont know what is it\n`;
            }
        }
        e.addFields(
            {
                name: 'Now playing',
                value: nowText,
            },
            {
                name: 'Up next',
                value: queueText
            });
        await cmd.reply({
            embeds: [e]
        });
    }

    displayYTtrack = (vid: Video): Discord.MessagePayload | Discord.BaseMessageOptions => {
        return { content: `Added **${vid.Snippet.Title}** to the queue!` };
    };

    displayYMTrack = (track: Track): Discord.MessagePayload | Discord.BaseMessageOptions => {
        return { content: `Added **${track.Title}** to the queue!` };
    };

    displayDirectTrack = (track: WebTrack): Discord.MessagePayload | Discord.BaseMessageOptions => {
        return { content: `Added **${track.Title}** to the queue` };
    };

    private getGuildPlayer(guild: Discord.Guild): GuildAudioPlayer {
        if (!this.players[guild.id]) {
            const p = new GuildAudioPlayer(guild);
            p.on('trackError', (t) => this.notifyError(t));
            this.players[guild.id] = p;
        }
        return this.players[guild.id];
    }

    private getLastTrack(user: Discord.GuildMember): AudioTrack | undefined {
        return this.lastTracks[user.user.id];
    }

    private setLastTrack(user: Discord.GuildMember, track: AudioTrack): void {
        this.lastTracks[user.user.id] = track;
    }
}

function parseYTLink(text: string): YTLinkType {
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

function parseYMLink(text: string): YMLinkType {
    try {
        const u = new URL(text);
        const tokens = u.pathname.split('/');
        if (tokens.at(1) === 'album') {
            if (tokens.length === 5) {
                // single track
                const trackId = tokens.at(-1);
                return {
                    type: 'track',
                    track: trackId,
                };
            } else {
                // full album
                const albumId = tokens.at(-1);
                return {
                    type: 'album',
                    album: albumId,
                };
            }
        } else if (tokens.length === 5 && tokens.at(3) === 'playlists') {
            const userId = tokens.at(2);
            const playlistId = tokens.at(-1);
            return {
                type: 'playlist',
                user: userId,
                playlist: playlistId,
            };
        }
    }
    catch {
        // whatever
    }

    return {
        type: 'invalid',
    };
}

interface YTLinkType {
    type: 'video' | 'playlist' | 'invalid'
    list: string | null
    vid: string
}

type YMLinkType = YMLinkTrack | YMLinkAlbum | YMLinkPlaylist | YMLinkInvalid;
interface YMLinkTrack {
    type: 'track'
    track: string
}
interface YMLinkAlbum {
    type: 'album'
    album: string
}
interface YMLinkPlaylist {
    type: 'playlist'
    user: string
    playlist: string
}
interface YMLinkInvalid {
    type: 'invalid'
}

export default AudioManagerService;
