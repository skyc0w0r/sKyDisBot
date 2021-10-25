import Discord from 'discord.js';
import Logger from 'log4js';
import human from '../human.js';
import { AliasCollection, CategoryCollection, CategoryWrapper, CommandCallback, CommandCollection } from '../Model/CmdParserModels.js';

/**
 * Use to parse text chat command
 * How to use:
 *  1. Register commands/categories/aliases
 *  2. Call dispatch
 *   - Dispatch will search for candidates
 *     to execute command in following order
 *     alias > category > command
 */
class CommandParser {
    public get Name(): string {
        return this.name;
    }
    public get Parent(): CommandParser | undefined {
        return this.parent;
    }

    private commands: CommandCollection;
    private categories: CategoryCollection;
    private aliases: AliasCollection;
    private wrapper: CategoryWrapper;
    private parent: CommandParser | undefined;
    private name: string;

    private logger: Logger.Logger;
    constructor(filter: CategoryWrapper | undefined = undefined) {
        this.commands = {};
        this.categories = {};
        this.aliases = {};
        this.wrapper = filter;
        this.name = '/';

        this.logger = Logger.getLogger('command_parser');
    }

    /**
     * Determines who should (if anyone) to process chat command
     * @param text command arguments
     * @param original original message
     * @returns 
     */
    public async Dispatch(text: string, original: Discord.Message): Promise<void> {
        this.logger.debug(human._s(this), '<', text);
        const tokens = text.split(/\s+/);
        if (tokens.length < 1) {
            return;
        }

        const cmd = tokens.shift();
        const postfix = tokens.join(' ');

        if (this.aliases[cmd]) {
            this.logger.debug(human._s(this), '}', cmd);
            await this.aliases[cmd].parser.execute(this.aliases[cmd].name, postfix, original);
        } else if (this.categories[cmd]) {
            this.logger.debug(human._s(this), '>>', cmd);
            await this.categories[cmd].Dispatch(postfix, original);
        } else if (this.commands[cmd]) {
            this.logger.debug(human._s(this), '>', cmd);
            await this.execute(cmd, postfix, original);
        }
    }

    /**
     * Adds new available command
     * @param name name of the command
     * @param callback it should proccess command
     * @returns 
     */
    public RegisterCommand(name: string | string[], callback: CommandCallback): void {
        if (Array.isArray(name)) {
            for (const n of name) {
                this.RegisterCommand(n, callback);
            }
            return;
        }
        this.logger.debug(human._s(this), '+>', name);
        
        this.commands[name] = callback;
    }

    /**
     * Adds a new available category
     * @param name name of subcategory
     * @param wrapper decorator for the target command (put checks and try/catch there)
     * @returns 
     */
    public RegisterCategory(name: string, wrapper: CategoryWrapper | undefined = undefined): CommandParser {
        this.logger.debug(human._s(this), '+>>', name);
        const category = new CommandParser(wrapper);
        category.parent = this;
        category.name = name;
        this.categories[name] = category; 
        return category;
    }

    /**
     * Adds command alias to the root parent of category 
     * @param from new command
     * @param to already registered command
     */
    public RegisterAlias(from: string, to: string): void {
        const tokensFrom = from.split(/\s+/);
        const tokensTo = to.split(/\s+/);

        if (tokensFrom.length < 1 || tokensTo.length < 1) {
            this.logger.warn('Invalid alias:', from, '->', to);
        }

        let root = this.parent || this;
        while (root.parent) {
            root = root.parent;
        }

        let catFrom = root;
        while (tokensFrom.length !== 1) {
            const token = tokensFrom.shift();
            catFrom = catFrom.categories[token];
            if (!catFrom) {
                this.logger.warn('Unable to add alias:', from, '->', to, ':', token, 'not found in', human._s(catFrom));
                return;
            }
        }
        const fromName = tokensFrom.shift();
        if (catFrom.checkRegistered(fromName)) {
            this.logger.warn('Path', fromName, 'on', human._s(catFrom), 'will be overwritten');
        }

        let catTo = root;
        while (tokensTo.length !== 1) {
            const token = tokensTo.shift();
            catTo = catTo.categories[token];
            if (!catFrom) {
                this.logger.warn('Unable to add alias:', from, '->', to, ':', token, 'not found in', human._s(catTo));
                return;
            }
        }
        const toName = tokensTo.shift();
        if (!catTo.commands[toName]) {
            this.logger.warn('Unable to add alias:', from, '->', to, ': Command', toName, 'not found in', human._s(catTo));
            return;
        }

        catFrom.aliases[fromName] = {
            parser: catTo,
            name: toName,
        };
        this.logger.debug('Added alias', from, '->', to);
    }

    /**
     * Executes registered command
     * @param cmd command name
     * @param postfix rest of argument
     * @param original original message
     */
     private async execute(cmd: string, postfix: string, original: Discord.Message): Promise<void> {
        if (this.wrapper) {
            await this.wrapper(postfix, original, this.commands[cmd]);
        } else {
            await this.commands[cmd](postfix, original);
        }
    }

    private checkRegistered(name: string): boolean {
        return !!this.commands[name] || !!this.categories[name] || !!this.aliases[name] || false;
    }
}

export default CommandParser;
