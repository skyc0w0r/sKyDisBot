import { StageChannel, TextBasedChannel } from 'discord.js';

export type ActualTextChannel = Exclude<TextBasedChannel, StageChannel>;
