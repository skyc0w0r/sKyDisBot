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
import { YouTubeTrack, WebTrack, AudioTrack, YandexTrack } from '../Model/AudioManager/index.js';
import WebLoader from './WebLoader.js';
import { LastTrackCollection } from '../Model/AudioManager/LastTrackCollection.js';
import { LoopMode } from '../Interface/LoopMode.js';
import YandexService from './YandexService.js';
import { ActualTextChannel } from '../Interface/Util.js';
import { DisplayCurrentTrack, DisplaySingleTrack, DisplayTrackQueue } from '../Helpers/TrackDisplay.js';
import { parseYMLink, parseYTLink, YMLinkType, YTLinkType } from '../Helpers/LinkParser.js';

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
        cp.RegisterCommand('play', (c) => this.playAnyHandler(c), {
            description: 'Play anything',
            options: [
                {
                    id: 'link',
                    description: 'Link to supported service or search query',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('playtop', (c) => this.playAnyHandler(c, true), {
            description: '[Queue top]Play anything',
            options: [
                {
                    id: 'link',
                    description: 'Link to supported service or search query',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('yt', (c) => this.playYouTubeHandler(c), {
            description: 'Play video/playlist from youtube. Also search&select first result',
            options: [
                {
                    id: 'link',
                    description: 'Link for youtube video/Search query',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('yttop', (c) => this.playYouTubeHandler(c, true), {
            description: '[Queue top]Play video/playlist from youtube. Also search&select first result',
            options: [
                {
                    id: 'link',
                    description: 'Link for youtube video/Search query',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('direct', (c) => this.playDirectHandler(c), {
            description: 'Plays audio file from web link',
            options: [
                {
                    id: 'url',
                    description: 'DIRECT url for audio file',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('directtop', (c) => this.playDirectHandler(c, true), {
            description: '[Queue top]Plays audio file from web link',
            options: [
                {
                    id: 'url',
                    description: 'DIRECT url for audio file',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('ym', (c) => this.playYandexMusicHandler(c), {
            description: 'Plays audio from yandex.music service',
            options: [
                {
                    id: 'link',
                    description: 'Link for Yandex Music/Search query',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('ymtop', (c) => this.playYandexMusicHandler(c, true), {
            description: '[Queue top]Plays audio from yandex.music service',
            options: [
                {
                    id: 'link',
                    description: 'Link for Yandex Music/Search query',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand(['search', 'find'], (c) => this.searchYouTubeHandler(c), {
            description: 'Search and select video from youtube',
            options: [
                {
                    id: 'query',
                    description: 'What to search for',
                    required: true,
                }
            ]
        });
        cp.RegisterCommand('yms', (c) => this.searchYandexMusicHandler(c), {
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

    // audio play
    private async playAnyHandler(cmd: BaseCommand, isTop = false): Promise<void> {
        await this.ensureVoice(cmd);

        const query = cmd.Params['link'].value;
        const ytLink = parseYTLink(query);
        if (ytLink.type !== 'invalid') {
            await this.playYouTube(cmd, ytLink, isTop);
            return;
        }

        const ymLink = parseYMLink(query);
        if (ymLink.type !== 'invalid') {
            await this.playYandexMusic(cmd, ymLink, isTop);
            return;
        }

        let url: URL;
        try {
            url = new URL(query);
            await this.playDirectLink(cmd, url, isTop);
            return;
        } catch (e) {
            // not a link
        }

        await this.playYouTube(cmd, ytLink, isTop);
    }

    // audio ym 
    private async playYandexMusicHandler(cmd: BaseCommand, isTop = false): Promise<void> {
        await this.ensureVoice(cmd);

        const link = parseYMLink(cmd.Params['link'].value);
        await this.playYandexMusic(cmd, link, isTop);
    }

    private async playYandexMusic(cmd: BaseCommand, link: YMLinkType, isTop = false): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        if (link.type === 'invalid') {
            const searchres = await this.ym.SearchTrack(link.query);
            if (searchres.length === 0) {
                await cmd.reply({ content: 'No results' });
                return;
            }
            const track = new YandexTrack(cmd, searchres[0], this.ym, this.audioConverter);
            p.enqueue(track, isTop);
            this.setLastTrack(cmd.User, track);

            this.logger.info(human._s(cmd.Guild), `Added yandex.music track (id: ${searchres[0].Id}) to queue`);
            await DisplaySingleTrack(cmd, track);
        } else if (link.type === 'track') {
            const info = await this.ym.GetTrackInfo(link.track);
            const track = new YandexTrack(cmd, info, this.ym, this.audioConverter);

            p.enqueue(track, isTop);
            this.setLastTrack(cmd.User, track);

            this.logger.info(human._s(cmd.Guild), `Added yandex.music track (id: ${info.Id}) to queue`);
            await DisplaySingleTrack(cmd, track);
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
    private async playDirectHandler(cmd: BaseCommand, isTop = false): Promise<void> {
        await this.ensureVoice(cmd);

        const urlText = cmd.Params['url'].value;
        let url: URL;
        try {
            url = new URL(urlText);
        } catch (e) {
            cmd.reply({ content: 'Invalid link 😠' });
            return;
        }

        await this.playDirectLink(cmd, url, isTop);
    }

    private async playDirectLink(cmd: BaseCommand, url: URL, isTop = false): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);

        const track = new WebTrack(cmd, url, this.webLoader, this.audioConverter);
        p.enqueue(track, isTop);
        this.setLastTrack(cmd.User, track);

        this.logger.info(human._s(cmd.Guild), `Added direct link track ${track.Url.toString()} to queue`);
        await DisplaySingleTrack(cmd, track);
    }

    // audio yt
    private async playYouTubeHandler(cmd: BaseCommand, isTop = false): Promise<void> {
        await this.ensureVoice(cmd);

        const link = parseYTLink(cmd.Params['link'].value);
        await this.playYouTube(cmd, link, isTop);
    }

    private async playYouTube(cmd: BaseCommand, link: YTLinkType, isTop = false): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);

        if (link.type === 'invalid') {
            // search and play first
            // await cmd.reply({content: 'Invalid link'});
            const searchres = await this.youtube.search(link.query);
            if (searchres.length === 0) {
                await cmd.reply({ content: 'No results' });
                return;
            }
            const track = new YouTubeTrack(cmd, searchres[0], this.youtube, this.audioConverter);
            p.enqueue(track, isTop);
            this.setLastTrack(cmd.User, track);

            this.logger.info(human._s(cmd.Guild), `Added youtube track (id: ${searchres[0].Id}) to queue`);
            await DisplaySingleTrack(cmd, track);
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
            await DisplaySingleTrack(cmd, track);
        }
    }

    // audio last
    private async playLast(cmd: BaseCommand): Promise<void> {
        await this.ensureVoice(cmd);
        const p = this.getGuildPlayer(cmd.Guild);

        const track = this.getLastTrack(cmd.User);
        if (!track) {
            await cmd.reply({ content: 'You havent played anything yet 💫' });
            return;
        }

        p.enqueue(track);
        await DisplaySingleTrack(cmd, track);
    }

    // audio search
    private async searchYouTubeHandler(cmd: BaseCommand): Promise<void> {
        await this.ensureVoice(cmd);

        const q = cmd.Params['query'].value;
        await this.searchYouTube(cmd, q);
    }

    private async searchYouTube(cmd: BaseCommand, query: string, isTop = false): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);

        const searchResults = await this.youtube.search(query);
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
        p.enqueue(track, isTop);
        this.setLastTrack(cmd.User, track);

        this.logger.info(human._s(cmd.Guild), `Added youtube track (id: ${vid.Id}) to queue`);
        await DisplaySingleTrack(cmd, track);
    }

    // audio yms
    private async searchYandexMusicHandler(cmd: BaseCommand): Promise<void> {
        await this.ensureVoice(cmd);
        const p = this.getGuildPlayer(cmd.Guild);

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
        await DisplaySingleTrack(cmd, track);
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
        const p = this.getGuildPlayer(cmd.Guild);
        if (!p.Current) {
            await cmd.reply({ content: 'Nothing playing 😥' });
            return;
        }

        await DisplayCurrentTrack(cmd, p);
    }

    // audio queue
    private async printQueue(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);

        if (p.Queue.length === 0) {
            await cmd.reply({ content: 'Nothing in queue 🥺' });
            return;
        }

        await DisplayTrackQueue(cmd, p);
    }

    private getGuildPlayer(guild: Discord.Guild): GuildAudioPlayer {
        if (!this.players[guild.id]) {
            const p = new GuildAudioPlayer(guild);
            p.on('trackError', (t, e) => this.notifyError(t, e));
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

    private async ensureVoice(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.Guild);
        if (p.Channel) {
            return;
        }

        if (!cmd.User.voice.channel) {
            await cmd.reply({ content: 'Join voice first!' });
        } else {
            await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);
        }
    }

    private async notifyError(track: AudioTrack, error: Error) {
        await track.Origin.reply({ content: `Failed to play **${track.Title}**: ${error.message}` });
    }
}

export default AudioManagerService;
