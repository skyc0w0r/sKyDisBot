import Discord from 'discord.js';
import Logger from 'log4js';
import human from '../human.js';
import { AliasCollection, CategoryCollection, CategoryWrapper, CommandCallback, CommandCollection, CommandParserServiceOptions } from '../Interface/CommandParserInterface.js';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { BaseCommand, InteractionCommand, MessageCommand, RegisteredCommand } from '../Model/CommandParser/index.js';

/**
 * Use to parse text chat command
 * How to use:
 *  1. Register commands/categories/aliases
 *  2. Call dispatch
 *   - Dispatch will search for candidates
 *     to execute command in following order
 *     alias > category > command
 */
class CommandParserService extends BaseService {
    public get Name(): string {
        return this.name;
    }
    public get Parent(): CommandParserService | undefined {
        return this.parent;
    }

    private commands: CommandCollection;
    private categories: CategoryCollection;
    private aliases: AliasCollection;
    private prefix: string;
    private wrapper: CategoryWrapper;
    private parent: CommandParserService | undefined;
    private name: string;

    private logger: Logger.Logger;
    constructor({ prefix, wrapper }: CommandParserServiceOptions = {}) {
        super();
        this.commands = {};
        this.categories = {};
        this.aliases = {};
        this.prefix = prefix;
        this.wrapper = wrapper;
        this.name = '';

        this.logger = Logger.getLogger('command_parser');
    }

    public async Dispatch(creator: Discord.Message | Discord.Interaction): Promise<void> {
        if (creator instanceof Discord.Message) {
            if (!creator.content.startsWith(this.prefix)) {
                return;
            }
            this.logger.info('+', human._s(creator));

            await this.DispatchInner(creator.content.substring(this.prefix.length).split(/\s+/), creator);
        }
        if (creator instanceof Discord.Interaction) {
            if (!creator.isCommand()) {
                return;
            }
            this.logger.info('+', human._s(creator));

            const tokens = [
                creator.commandName,
                creator.options.getSubcommandGroup(false),
                creator.options.getSubcommand(false)
            ].filter(c => !!c);
            await this.DispatchInner(tokens, creator);
        }
    }

    /**
     * Adds new available command
     * @param name name of the command
     * @param callback it should proccess command
     * @returns 
     */
    public RegisterCommand(name: string | string[], callback: CommandCallback): CommandParserService {
        if (Array.isArray(name)) {
            for (const n of name) {
                this.RegisterCommand(n, callback);
            }
            return this;
        }
        this.logger.debug(human._s(this), '+>', name);
        
        this.commands[name] = new RegisteredCommand({
            parser: this,
            name,
            callback
        });

        return this;
    }

    /**
     * Adds a new available category
     * @param name name of subcategory
     * @param wrapper decorator for the target command (put checks and try/catch there)
     * @returns 
     */
    public RegisterCategory(name: string, wrapper: CategoryWrapper | undefined = undefined): CommandParserService {
        this.logger.debug(human._s(this), '+>>', name);
        const category = new CommandParserService({wrapper});
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
            name: toName,
            command: catTo.commands[toName],
        };
        this.logger.debug('Added alias', from, '->', to);
    }

    /**
     * Generates data about available discord '/' commands
     * @returns List of available commands for discord
     */
    public GetDiscordCommandsData(): Discord.ApplicationCommandDataResolvable[] {
        const res: Discord.ApplicationCommandDataResolvable[] = [];
        
        const getParserCommands = (based: Omit<Discord.ChatInputApplicationCommandData, 'name' | 'description'>, parser: CommandParserService): Discord.ChatInputApplicationCommandData[] => {
            const parserCommands: Discord.ChatInputApplicationCommandData[] = [];
            for (const cmd of Object.keys(parser.commands).map(c => parser.commands[c])) {
                parserCommands.push({
                    ...based,
                    name: cmd.Name,
                    description: 'cmd <blank>'
                });
            }
            for (const cmd of Object.keys(parser.aliases).map(c => parser.aliases[c])) {
                parserCommands.push({
                    ...based,
                    name: cmd.name,
                    description: 'alias <blank>',
                });
            }
            return parserCommands;
        };

        getParserCommands({type: 1}, this).forEach(c => res.push(c));

        for (const subCategory of Object.keys(this.categories).map(c => this.categories[c])) {
            const opts: Discord.ApplicationCommandOptionData[] = [];
            opts.push(...(getParserCommands({type: 1}, subCategory) as unknown as Discord.ApplicationCommandSubCommandData[]));
            for (const subSubCategory of Object.keys(subCategory.categories).map(c => subCategory.categories[c])) {
                opts.push({
                    type: 2,
                    name: subSubCategory.Name,
                    description: 'grp <blank>',
                    options: getParserCommands({type: 1}, subSubCategory) as unknown as Discord.ApplicationCommandSubCommandData[]
                });
            }
            res.push({
                type: 1,
                name: subCategory.Name,
                description: 'cat <blank>',
                options: opts,
            });
        }
        
        this.logger.debug('Discord commands', JSON.stringify(res));

        return res;
    }


    /**
     * Determines who should (if anyone) to process chat command
     * @param tokens command arguments
     * @param creator original message
     * @returns 
     */
    private async DispatchInner(tokens: string[], creator: Discord.Message | Discord.CommandInteraction): Promise<void> {
        this.logger.debug(human._s(this), '<', tokens);
        if (tokens.length < 1) {
            return;
        }

        const cmd = tokens.shift();
        let command: BaseCommand;

        if (creator instanceof Discord.Message) {
            command = new MessageCommand({
                user: creator.member,
                channel: creator.channel,
                message: creator
            });
        } else if (creator instanceof Discord.CommandInteraction) {
            // not supported (yet?)
            if (!(creator.member instanceof Discord.GuildMember)) {
                return;
            }

            command = new InteractionCommand({
                user: creator.member,
                channel: creator.channel,
                interaction: creator,
            });
        }

        if (this.aliases[cmd]) {
            this.logger.debug(human._s(this), '}', cmd);
            await this.aliases[cmd].command.Parser.execute(cmd, command);
        } else if (this.categories[cmd]) {
            this.logger.debug(human._s(this), '>>', cmd);
            await this.categories[cmd].DispatchInner(tokens, creator);
        } else if (this.commands[cmd]) {
            this.logger.debug(human._s(this), '>', cmd);
            await this.execute(cmd, command);
        }
    }

    /**
     * Executes registered command
     * @param cmd command name
     * @param postfix rest of argument
     * @param original original message
     */
    private async execute(cmd: string, creator: BaseCommand): Promise<void> {
        if (this.wrapper) {
            await this.wrapper(creator, this.commands[cmd].Callback);
        } else {
            await this.commands[cmd].Callback(creator);
        }
    }

    private checkRegistered(name: string): boolean {
        return !!this.commands[name] || !!this.categories[name] || !!this.aliases[name] || false;
    }
}

export default CommandParserService;
