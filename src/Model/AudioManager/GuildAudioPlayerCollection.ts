import { Snowflake } from 'discord.js/typings/index.js';
import GuildAudioPlayer from '../../Class/GuildAudioPlayer.js';

export interface GuildAudioPlayerCollection {
    [key: Snowflake]: GuildAudioPlayer
};
