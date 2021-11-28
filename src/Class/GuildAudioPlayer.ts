import Discord from 'discord.js';
import DSVoice, { AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice';
import Logger from 'log4js';
import human from '../human.js';
import { AudioTrack } from '../Model/AudioManager/index.js';

class GuildAudioPlayer {
    public get Guild(): Discord.Guild {
        return this.guild;
    }
    public get Channel(): Discord.VoiceChannel {
        return this.channel;
    }
    public get Current(): AudioTrack {
        return this.current;
    }
    public get Queue(): AudioTrack[] {
        return this.queue;
    }

    private guild: Discord.Guild;
    private channel?: Discord.VoiceChannel;

    private voice: DSVoice.VoiceConnection;
    private player: DSVoice.AudioPlayer;
    private connectLock: boolean;

    private current: AudioTrack;
    private queue: Array<AudioTrack>;
    private queueLock: boolean;
    private isPlayerSignalled: boolean;
    private logger: Logger.Logger;

    constructor(guild: Discord.Guild) {
        this.guild = guild;

        this.connectLock = false;
        this.queue = [];
        this.queueLock = false;
        this.isPlayerSignalled = false;
        this.logger = Logger.getLogger('guild_audio');

        this.onVoiceStateChanged = this.onVoiceStateChanged.bind(this);
        this.onPlayerStateChanged = this.onPlayerStateChanged.bind(this);
    }

    /**
     * Joins voice channel
     * @param channel Voice channel to join
     * @param force If true, will leave the current and join new
     * @returns 
     */
    public async joinVoice(channel: Discord.VoiceChannel, force = false): Promise<void> {
        if (!force && this.channel && this.voice) {
            return;
        }
        if (force && this.voice) {
            if (this.voice.rejoin({...this.voice.joinConfig, channelId: channel.id})) {
                return;
            }
        }
        this.voice = DSVoice.joinVoiceChannel({
            guildId: this.guild.id,
            channelId: channel.id,
            adapterCreator: this.guild.voiceAdapterCreator as unknown as DSVoice.DiscordGatewayAdapterCreator
        });
        this.player = new DSVoice.AudioPlayer();
        this.voice.on('stateChange', this.onVoiceStateChanged);
        this.voice.on('error', (e) => {
            this.logger.warn(human._s(this), 'Voice error', e.name, e.message);
        });
        this.player.on('stateChange', this.onPlayerStateChanged);
        this.player.on('error', (e) => {
            this.logger.warn(human._s(this), 'Player error', e.name, e.message);
        });

        this.voice.subscribe(this.player);

        this.channel = channel;
    }

    public leaveVoice(): void {
        this.logger.info(human._s(this), 'Requested voice channel leave');
        
        this.queue = [];
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
            this.current.Abort();
            this.current.Cleanup();
        }

        this.voice = undefined;
        this.current = undefined;
    }

    public enqueue(track: AudioTrack): void {
        this.queue.push(track);
        this.checkQueue();
    }

    public skip(): void {
        if (this.current) {
            this.logger.info(human._s(this), 'Skipping track');
            this.current.Abort();
            this.player.stop();
            this.current.Cleanup();
        }
    }

    public togglePause(): boolean {
        if (!this.player) {
            return false;
        }
        if (this.player.state.status === DSVoice.AudioPlayerStatus.Playing) {
            this.player.pause();
            return true;
        } else if (this.player.state.status === DSVoice.AudioPlayerStatus.Paused) {
            this.player.unpause();
            return true;
        }
        return false;
    }

    private async onVoiceStateChanged(oldS: DSVoice.VoiceConnectionState, newS: DSVoice.VoiceConnectionState): Promise<void> {
        // this.logger.debug(human._s(this.guild), 'voice state from', oldS.status, 'to', newS.status);

        if (newS.status === DSVoice.VoiceConnectionStatus.Disconnected) {
            this.logger.debug(human._s(this), 'Voice disconnected');
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
            this.logger.debug(human._s(this), 'Trying to connect to voice');
            this.connectLock = true;

            try {
                // to prevent endless connecting, limiting it to 20s
                await DSVoice.entersState(this.voice, DSVoice.VoiceConnectionStatus.Ready, 20e3);
            } catch (e) {
                this.logger.error(human._s(this), 'Failed to join guild', e);
                this.leaveVoice();
            } finally {
                this.connectLock = false;
            }
        } else if (newS.status === DSVoice.VoiceConnectionStatus.Ready) {
            this.logger.debug(human._s(this), 'Connected to voice');
            this.checkQueue();
        }
    }

    private async onPlayerStateChanged(oldS: DSVoice.AudioPlayerState, newS: DSVoice.AudioPlayerState): Promise<void> {
        // this.logger.debug(human._s(this.guild), 'player state from', oldS.status, 'to', newS.status);
        // Finished playing
        if (oldS.status !== DSVoice.AudioPlayerStatus.Idle && newS.status === DSVoice.AudioPlayerStatus.Idle) {
            this.logger.debug(human._s(this), 'Player finished playing');
            this.checkQueue();
        } else if (oldS.status === DSVoice.AudioPlayerStatus.Idle && newS.status === DSVoice.AudioPlayerStatus.Buffering) {
            this.logger.debug(human._s(this), 'Player acknowledged new track');
            this.isPlayerSignalled = false;
        }
    }

    private checkQueue(): void {
        if (this.queueLock
            || this.queue.length === 0
            || this.player?.state?.status !== AudioPlayerStatus.Idle
            || this.voice?.state?.status !== VoiceConnectionStatus.Ready
            || this.isPlayerSignalled) {
            return;
        }

        this.logger.debug(human._s(this), 'Checking queue');

        this.queueLock = true;
        if (this.current) {
            this.current.Abort();
            this.current.Cleanup();
        }
        const t = this.queue.shift();
        try {
            const audioRes = DSVoice.createAudioResource(t.CreateReadable(), {inputType: DSVoice.StreamType.OggOpus});
            this.isPlayerSignalled = true;
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
