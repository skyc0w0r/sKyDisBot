import Discord from 'discord.js';
import DSVoice, { AudioPlayerStatus } from '@discordjs/voice';
import Logger from 'log4js';
import human from '../human.js';
import AudioTrack from '../Model/AudioManager/AudioTrack.js';

class GuildAudioPlayer {
    private guild: Discord.Guild;
    private channel?: Discord.VoiceChannel;

    private voice: DSVoice.VoiceConnection;
    private player: DSVoice.AudioPlayer;
    private connectLock: boolean;

    private current: AudioTrack;
    private queue: Array<AudioTrack>;
    private queueLock: boolean;
    private logger: Logger.Logger;

    constructor(guild: Discord.Guild) {
        this.guild = guild;

        this.connectLock = false;
        this.queue = [];
        this.queueLock = false;
        this.logger = Logger.getLogger('guild_audio');

        this.onVoiceStateChanged = this.onVoiceStateChanged.bind(this);
        this.onPlayerStateChanged = this.onPlayerStateChanged.bind(this);
    }

    public async joinVoice(channel: Discord.VoiceChannel): Promise<void> {
        if (this.channel && this.voice) {
            return;
        }
        this.voice = DSVoice.joinVoiceChannel({
            guildId: this.guild.id,
            channelId: channel.id,
            adapterCreator: this.guild.voiceAdapterCreator as unknown as DSVoice.DiscordGatewayAdapterCreator
        });
        this.player = new DSVoice.AudioPlayer();
        this.voice.on('stateChange', this.onVoiceStateChanged);
        this.voice.on('error', (e) => {
            this.logger.warn(human._s(this.guild), 'Voice error', e);
        });
        this.player.on('stateChange', this.onPlayerStateChanged);
        this.player.on('error', (e) => {
            this.logger.warn(human._s(this.guild), 'Player error', e);
        });

        this.voice.subscribe(this.player);

        this.channel = channel;
        this.logger.info(human._s(this.guild), 'joined voice channel', human._s(this.channel));
    }

    public leaveVoice(): void {
        this.logger.info(human._s(this.guild), 'left voice channel', human._s(this.channel));

        if (this.player) {
            this.player.removeListener('stateChange', this.onPlayerStateChanged);
            this.player.stop();
        }

        if (this.voice) {
            this.voice.removeListener('stateChange', this.onVoiceStateChanged);
            if (this.voice.state.status !== DSVoice.VoiceConnectionStatus.Destroyed) {
                if (this.voice.state.status !== DSVoice.VoiceConnectionStatus.Disconnected) {
                    this.voice.disconnect();
                }
                this.voice.destroy();  
            }  
        }

        if (this.current) {
            this.current.Cleanup();
        }

        this.voice = undefined;
        this.current = undefined;
    }

    public enqueue(track: AudioTrack): void {
        this.queue.push(track);
        this.checkQueue();
    }

    private async onVoiceStateChanged(oldS: DSVoice.VoiceConnectionState, newS: DSVoice.VoiceConnectionState): Promise<void> {
        this.logger.debug(human._s(this.guild), 'voice state from', oldS.status, 'to', newS.status);

        if (newS.status === DSVoice.VoiceConnectionStatus.Disconnected) {
            // try to reconnect by websocket
            if (newS.reason === DSVoice.VoiceConnectionDisconnectReason.WebSocketClose && newS.closeCode === 4014) {
                try {
                    await DSVoice.entersState(this.voice, DSVoice.VoiceConnectionStatus.Connecting, 5e3);
                } catch (e) {
                    this.leaveVoice();
                }
            // try to reconnect manually
            } else if (this.voice.rejoinAttempts < 5) {
                await new Promise<void>(resolve => setTimeout(() => resolve(), 5e3));
                this.voice.rejoin();
            // we are dead
            } else {
                this.leaveVoice();
            }
        } else if (newS.status === DSVoice.VoiceConnectionStatus.Destroyed) {
            this.leaveVoice();
        // we are connecting
        } else if (!this.connectLock && (newS.status === DSVoice.VoiceConnectionStatus.Connecting || newS.status === DSVoice.VoiceConnectionStatus.Signalling)) {
            this.connectLock = true;

            try {
                // to prevent endless connecting, limiting it to 20s
                await DSVoice.entersState(this.voice, DSVoice.VoiceConnectionStatus.Ready, 20e3);
            } catch (e) {
                this.logger.error(human._s(this.guild), 'Failed to join guild', e);
                this.leaveVoice();
            } finally {
                this.connectLock = false;
            }
        }
    }

    private async onPlayerStateChanged(oldS: DSVoice.AudioPlayerState, newS: DSVoice.AudioPlayerState): Promise<void> {
        this.logger.debug(human._s(this.guild), 'player state from', oldS.status, 'to', newS.status);
        // Finished playing
        if (oldS.status !== DSVoice.AudioPlayerStatus.Idle && newS.status === DSVoice.AudioPlayerStatus.Idle) {
            this.checkQueue();
        }
    }

    private checkQueue(): void {
        if (this.queueLock || this.queue.length === 0 || this.player?.state?.status === AudioPlayerStatus.Playing) {
            return;
        }

        this.queueLock = true;
        const t = this.queue.shift();
        try {
            const audioRes = DSVoice.createAudioResource(t.Stream, {inputType: DSVoice.StreamType.OggOpus});
            this.player.play(audioRes);
            this.current = t;
            this.queueLock = false;
        } catch (e) {
            this.logger.warn(human._s(this.guild), 'failed to play', e);
            this.queueLock = false;
            this.checkQueue();
        }
    }
}

export default GuildAudioPlayer;
