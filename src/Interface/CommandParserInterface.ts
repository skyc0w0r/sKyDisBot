import Discord from 'discord.js';
import { BaseCommand, RegisteredCommand } from '../Model/CommandParser/index.js';
import CommandParser from '../Service/CommandParserService.js';

export type CommandParserServiceOptions = {
    prefix?: string
    wrapper?: CategoryWrapper
};

export type CommandCallback = (cmd: BaseCommand) => void | Promise<void>;
export type CategoryWrapper = (cmd: BaseCommand, inner: CommandCallback) => void | Promise<void>;

export interface CommandCollection {
    [key: string]: RegisteredCommand
}
export interface CategoryCollection {
    [key: string]: CommandParser
}
export interface CommandAlias {
    command: RegisteredCommand
    name: string
}
export interface AliasCollection {
    [key: string]: CommandAlias
}

export interface BaseCommandData {
    user: Discord.GuildMember
    channel: Discord.TextBasedChannels
}

export interface MessageCommandData extends BaseCommandData {
    message: Discord.Message
}

export interface InteractionCommandData extends BaseCommandData {
    interaction: Discord.CommandInteraction
}
