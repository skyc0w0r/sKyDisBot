import { Snowflake } from 'discord.js';
import { GuildAudioPlayer } from '../../Class/GuildAudioPlayer.js';

export interface GuildAudioPlayerCollection {
    [key: Snowflake]: GuildAudioPlayer
}
