import Discord from 'discord.js';
import Logger from 'log4js';
import human from '../human.js';
import { AudioTrack } from '../Model/AudioManager/index.js';
import EventEmitter from 'node:events';
import { LoopMode } from '../Interface/LoopMode.js';
import { AudioPlayer, AudioPlayerState, AudioPlayerStatus, createAudioResource, DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, StreamType, VoiceConnection, VoiceConnectionDisconnectReason, VoiceConnectionState, VoiceConnectionStatus } from '@discordjs/voice';

interface GuildAudioPlayerEvents {
    trackError: [AudioTrack, Error]
}

export class GuildAudioPlayer extends EventEmitter<GuildAudioPlayerEvents> {
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
    public get PlayDuration(): number {
        if (this.lastPlayStarted) {
            return Math.floor(((new Date().getTime() - this.lastPlayStarted.getTime()) - (this.pauseDuration || 0)) / 1000);
        }
        return 0;
    }
    public get LoopMode(): LoopMode {
        return this.loopMode;
    }

    private guild: Discord.Guild;
    private channel?: Discord.VoiceChannel;

    private voice: VoiceConnection;
    private player: AudioPlayer;
    private connectLock: boolean;

    private current: AudioTrack;
    private queue: Array<AudioTrack>;
    private queueLock: boolean;
    private loopMode: LoopMode;

    private lastPlayStarted?: Date;
    private lastPaused?: Date;
    private pauseDuration?: number;

    private isPlayerSignalled: boolean;
    private logger: Logger.Logger;

    constructor(guild: Discord.Guild) {
        super();

        this.guild = guild;

        this.connectLock = false;
        this.queue = [];
        this.queueLock = false;
        this.loopMode = 'none';
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
        this.voice = joinVoiceChannel({
            guildId: this.guild.id,
            channelId: channel.id,
            adapterCreator: this.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator
        });
        this.player = new AudioPlayer();
        this.voice.on('stateChange', this.onVoiceStateChanged);
        this.voice.on('error', (e) => {
            this.logger.warn(human._s(this), 'Voice error', e.name, e.message);
        });
        this.player.on('stateChange', this.onPlayerStateChanged);
        this.player.on('error', (e) => {
            this.logger.warn(human._s(this), 'Player error', e.name, e.message);
            this.emit('trackError', e.resource.metadata as AudioTrack, e);
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
            if (this.voice.state.status !== VoiceConnectionStatus.Destroyed) {
                if (this.voice.state.status !== VoiceConnectionStatus.Disconnected) {
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

    public enqueue(track: AudioTrack, isTop = false): void {
        if (isTop) this.queue.unshift(track);
        else this.queue.push(track);
        this.checkQueue();
    }

    public skip(skipCount = 1): void {
        if (this.current) {
            this.logger.info(human._s(this), `Skipping ${skipCount} track(s)`);
            if (this.loopMode === 'one') {
                this.queue.shift();
            }
            this.queue.splice(0, skipCount - 1);
            this.player.stop();
            // this.current.Cleanup();
        }
    }

    public togglePause(): boolean {
        if (!this.player) {
            return false;
        }
        if (this.player.state.status === AudioPlayerStatus.Playing) {
            this.player.pause();
            return true;
        } else if (this.player.state.status === AudioPlayerStatus.Paused) {
            this.player.unpause();
            return true;
        }
        return false;
    }

    public toggleLoop(loopOption: LoopMode): boolean {
        if (!this.player || !this.current) {
            return false;
        }

        this.loopMode = loopOption;
        return true;
    }

    private async onVoiceStateChanged(oldS: VoiceConnectionState, newS: VoiceConnectionState): Promise<void> {
        // this.logger.debug(human._s(this.guild), 'voice state from', oldS.status, 'to', newS.status);

        if (newS.status === VoiceConnectionStatus.Disconnected) {
            this.logger.debug(human._s(this), 'Voice disconnected');
            // try to reconnect by websocket
            if (newS.reason === VoiceConnectionDisconnectReason.WebSocketClose && newS.closeCode === 4014) {
                try {
                    await entersState(this.voice, VoiceConnectionStatus.Connecting, 5e3);
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
        } else if (newS.status === VoiceConnectionStatus.Destroyed) {
            this.leaveVoice();
        // we are connecting
        } else if (!this.connectLock && (newS.status === VoiceConnectionStatus.Connecting || newS.status === VoiceConnectionStatus.Signalling)) {
            this.logger.debug(human._s(this), 'Trying to connect to voice');
            this.connectLock = true;

            try {
                // to prevent endless connecting, limiting it to 20s
                await entersState(this.voice, VoiceConnectionStatus.Ready, 20e3);
            } catch (e) {
                this.logger.error(human._s(this), 'Failed to join guild', e);
                this.leaveVoice();
            } finally {
                this.connectLock = false;
            }
        } else if (newS.status === VoiceConnectionStatus.Ready) {
            this.logger.debug(human._s(this), 'Connected to voice');
            this.checkQueue();
        }
    }

    private async onPlayerStateChanged(oldS: AudioPlayerState, newS: AudioPlayerState): Promise<void> {
        // this.logger.debug(human._s(this.guild), 'player state from', oldS.status, 'to', newS.status);
        // Finished playing
        if (oldS.status !== AudioPlayerStatus.Idle && newS.status === AudioPlayerStatus.Idle) {
            this.logger.debug(human._s(this), 'Player finished playing');
            if (this.current) {
                this.current.Cleanup();
            }
            this.checkQueue();
        // Started buffering
        } else if (oldS.status === AudioPlayerStatus.Idle && newS.status === AudioPlayerStatus.Buffering) {
            this.logger.debug(human._s(this), 'Player acknowledged new track');
            this.isPlayerSignalled = false;
        // Started playing
        } else if (oldS.status === AudioPlayerStatus.Buffering && newS.status === AudioPlayerStatus.Playing) {
            this.lastPlayStarted = new Date();
        // Paused
        } else if (oldS.status === AudioPlayerStatus.Playing && newS.status === AudioPlayerStatus.Paused) {
            this.lastPaused = new Date();
        // Unpaused
        } else if (oldS.status === AudioPlayerStatus.Paused && newS.status === AudioPlayerStatus.Playing) {
            if (this.lastPaused) {
                this.pauseDuration = (this.pauseDuration || 0) + (new Date().getTime() - this.lastPaused.getTime());
            }
        }
    }

    private checkQueue(): void {
        if (this.queueLock
            || this.player?.state?.status !== AudioPlayerStatus.Idle
            || this.voice?.state?.status !== VoiceConnectionStatus.Ready
            || this.isPlayerSignalled) {
            return;
        }

        this.logger.debug(human._s(this), 'Checking queue');

        this.queueLock = true;
        if (this.current) {
            // this.current.Cleanup();

            if (this.LoopMode === 'one') {
                this.queue.unshift(this.current);
            } else if (this.loopMode === 'all') {
                this.queue.push(this.current);
            } else {
                // this.current.Cleanup();
            }
        }

        if (this.queue.length === 0) {
            this.queueLock = false;
            return;
        }

        const t = this.queue.shift();
        try {
            const audioRes = createAudioResource<AudioTrack>(t.CreateReadable(), {inputType: StreamType.OggOpus, metadata: t});
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
