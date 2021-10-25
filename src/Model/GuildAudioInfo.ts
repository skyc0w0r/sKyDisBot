import Discord from 'discord.js';
import EventEmitter from 'events';
import PlayState from '../Enum/PlayState.js';
import AudioConvertionInfo from './AudioConvertionInfo.js';
import IAudioMessage from './IAudioMessage.js';

class GuildAudioInfo extends EventEmitter {
    public guild: Discord.Guild;
    public voiceChannel: Discord.VoiceChannel | undefined;
    public voiceConnection: Discord.VoiceConnection | undefined;
    public voiceDispatch: Discord.StreamDispatcher | undefined;
    public queue: IAudioMessage[];
    public audioInfo: AudioConvertionInfo | undefined;
    public playState: PlayState;

    constructor(guild: Discord.Guild) {
        super();
        this.guild = guild;
        this.queue = [];
        this.playState = PlayState.Stopped;
    }

    public async joinChannel(channel: Discord.VoiceChannel): Promise<void> {
        if (this.voiceChannel && this.voiceConnection) {
            return;
        }
        await this.leaveChannel();

        this.voiceChannel = channel;
        this.voiceConnection = await this.voiceChannel.join();
        this.voiceDispatch = undefined;
    }

    public play(info: AudioConvertionInfo): void {
        if (!this.voiceConnection) {
            return;
        }
        this.playState = PlayState.Playing;
        this.voiceDispatch = this.voiceConnection.play(info.outStream, { type: 'converted' });
        this.voiceDispatch.on('close', () => this.finished());
        this.voiceDispatch.on('finish', () => this.finished());
        this.audioInfo = info;
    }

    public async leaveChannel(): Promise<void> {
        if (!this.voiceConnection || !this.voiceChannel) {
            return;
        }

        this.voiceConnection.disconnect();
        this.voiceChannel.leave();

        this.voiceChannel = undefined;
        this.voiceConnection = undefined;
        this.voiceDispatch = undefined;
        this.audioInfo = undefined;
    }

    private finished(): void {
        this.audioInfo = undefined;
        this.playState = PlayState.Stopped;
        this.emit('finish');
    }
}

interface GuildAudioInfoCollection {
    [key: string]: GuildAudioInfo
}

export {
    GuildAudioInfo, GuildAudioInfoCollection
};
