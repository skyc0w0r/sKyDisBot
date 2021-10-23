import Discord from 'discord.js';
import EventEmitter from 'events';
import PlayState from '../Enum/PlayState.js';
import AudioConvertionInfo from './AudioConvertionInfo.js';
import IAudioMessage from './IAudioMessage.js';

class GuildAudioInfo extends EventEmitter {
    public Id: string;
    public voiceDispatch: Discord.StreamDispatcher | undefined;
    public voiceConnection: Discord.VoiceConnection | undefined;
    public voiceChannel: Discord.VoiceChannel | undefined;
    public queue: IAudioMessage[];
    public playState: PlayState;
    public audioInfo: AudioConvertionInfo;

    constructor(id: string) {
        super();
        this.Id = id;
        this.queue = [];
        this.playState = PlayState.Stopped;
    }

    public async joinChannel(channel: Discord.VoiceChannel): Promise<void> {
        if (this.voiceChannel && this.voiceChannel.id === channel?.id) {
            // we are already there
            return;
        }
        // this.voiceConnection.disconnect();
        this.voiceChannel = channel;
        this.voiceConnection = await this.voiceChannel.join();
        this.voiceDispatch = undefined;
    }

    public play(info: AudioConvertionInfo): void {
        this.playState = PlayState.Playing;
        this.voiceDispatch = this.voiceConnection.play(info.outStream, { type: 'converted' });
        this.voiceDispatch.on('close', () => this.finished());
        this.voiceDispatch.on('finish', () => this.finished());
        this.audioInfo = info;
    }

    private finished(): void {
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
