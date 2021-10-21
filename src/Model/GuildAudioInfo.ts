import Discord from 'discord.js';
import EventEmitter from 'events';
import { Readable } from 'stream';
import PlayState from '../Enum/PlayState.js';
import IAudioMessage from './IAudioMessage.js';

class GuildAudioInfo extends EventEmitter {
    public voiceDispatch: Discord.StreamDispatcher | undefined;
    public voiceConnection: Discord.VoiceConnection | undefined;
    public voiceChannel: Discord.VoiceChannel | undefined;
    public queue: IAudioMessage[];
    public playState: PlayState;
    public destroyer: () => void;

    constructor() {
        super();
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

    public play(stream: Readable, destroyer: () => void): void {
        this.playState = PlayState.Playing;
        this.voiceDispatch = this.voiceConnection.play(stream, { type: 'converted' });
        this.voiceDispatch.on('close', () => this.finished());
        this.voiceDispatch.on('finish', () => this.finished());
        this.destroyer = destroyer;
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
