import Discord from 'discord.js';
import CommandParser from '../Service/CommandParser.js';

export type CommandCallback = (text: string, msg: Discord.Message) => void | Promise<void>;
export type CategoryWrapper = (text: string, msg: Discord.Message, targer: CommandCallback) => void | Promise<void>;

export interface CommandCollection {
    [key: string]: CommandCallback
}
export interface CategoryCollection {
    [key: string]: CommandParser
}
export interface CommandAlias {
    parser: CommandParser
    name: string
}
export interface AliasCollection {
    [key: string]: CommandAlias
}
