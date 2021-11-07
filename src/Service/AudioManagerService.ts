import Discord, { Interaction } from 'discord.js';
import DSVoice from '@discordjs/voice';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import CommandParserService from './CommandParserService.js';
import { GlobalServiceManager } from './ServiceManager.js';
import { createReadStream } from 'fs';
import AudioConverter from './AudioConverter.js';
import Logger from 'log4js';
import YouTubeService from './YouTubeService.js';
import { GuildAudioPlayerCollection } from '../Model/AudioManager/GuildAudioPlayerCollection.js';
import GuildAudioPlayer from '../Class/GuildAudioPlayer.js';
import TestTrack from '../Model/AudioManager/TestTrack.js';
import { CommandCallback } from '../Interface/CommandParserInterface.js';
import human from '../human.js';
import YouTubeTrack from '../Model/AudioManager/YouTubeTrack.js';

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
        p.enqueue(new TestTrack(cs.outStream));

        await cmd.reply({content: 'Enqueued 👍'});
    }

    private async playYTLink(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.voice.channel) {
            await cmd.reply({content: 'Join voice first!'});
            return;
        }
        const p = this.getGuildPlayer(cmd.Guild);
        await p.joinVoice(cmd.User.voice.channel as Discord.VoiceChannel);

        const link = parseYTLink(cmd.Params['link'].value);
        if (!link) {
            await cmd.reply({content: 'Invalid link'});
            return;
        }
        if (link.type === 'playlist') {
            // enqueue all songs from playlist
        } else if (link.type === 'video') {
            // enqueue song by id
            // g.queue.push(new AudioYTMessage(msg, link.vid));
            const stream = this.youtube.getAudioStream(link.vid);
            const info = this.audioConverter.convertForDis(stream);
            info.outStream.on('error', (e: Error) => {
                this.logger.warn('Track fail', e);
                // this.destroyPlayer(guild);
                // this.notifyError(audio.msg, e);
            });
            p.enqueue(new YouTubeTrack(info.outStream, () => {
                this.audioConverter.abortConvertion(info);
            }));

            this.logger.info(human._s(cmd.Guild), 'Added youtube track to queue');
            await cmd.reply({content: 'Enqueued 👍'});

            // this.playStreamTo(msg.guild);
        }
    }

    private async leave(cmd: BaseCommand): Promise<void> {
        const p = this.getGuildPlayer(cmd.User.guild);
        p.leaveVoice();
        await cmd.reply({content: 'Bye 👋'});
    }
    
    private getGuildPlayer(guild: Discord.Guild): GuildAudioPlayer {
        if(!this.players[guild.id]) {
            this.players[guild.id] = new GuildAudioPlayer(guild);
            // this.players[guild.id].on('finish', () => this.playStreamTo(guild));
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

export default AudioManagerService;
