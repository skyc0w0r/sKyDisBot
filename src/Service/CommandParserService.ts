import Discord, { ActionRowBuilder, ApplicationCommandOptionType, ApplicationCommandType, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import Logger from 'log4js';
import { UserActionEmitter } from '../Class/UserActionEmitter.js';
import human from '../human.js';
import { AliasCollection, CategoryCollection, CategoryWrapper, CommandAlias, CommandCallback, CommandCollection, CommandParserServiceOptions } from '../Interface/CommandParserInterface.js';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { UserPromtResult } from '../Interface/UserPromtResult.js';
import { CommandCreationOptions, CommandParamCollection } from '../Model/CommandParser/CommandOption.js';
import { BaseCommand, InteractionCommand, MessageCommand, RegisteredCommand } from '../Model/CommandParser/index.js';
import { ActualTextChannel } from '../Interface/Util.js';

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
    public get FullName(): string {
        if (this.Parent) {
            return `${this.Parent.FullName}${this.Name}/`;
        }
        return this.Name;
    }
    public get Parent(): CommandParserService | undefined {
        return this.parent;
    }
    public get GrandParent(): CommandParserService {
        return this.parent ? this.parent.GrandParent : this;
    }

    private commands: CommandCollection;
    private categories: CategoryCollection;
    private aliases: AliasCollection;
    private prefix: string;
    private wrapper: CategoryWrapper;
    private parent: CommandParserService | undefined;
    private name: string;
    private description: string;
    private actionEmitter: UserActionEmitter;

    private logger: Logger.Logger;
    constructor({ prefix, wrapper, description }: CommandParserServiceOptions = {}) {
        super();
        this.commands = {};
        this.categories = {};
        this.aliases = {};
        this.prefix = prefix;
        this.wrapper = wrapper;
        this.name = '/';
        this.description = description || 'No description provided';
        this.actionEmitter = new UserActionEmitter();

        this.logger = Logger.getLogger('command_parser');
    }

    public Init(): void {
        return;
    }
    public Destroy(): void {
        return;
    }


    public async Dispatch(creator: Discord.Message | Discord.Interaction): Promise<void> {
        if (creator instanceof Discord.Message) {
            if (!creator.content.startsWith(this.prefix)) {
                this.actionEmitter.emitOnMessage(creator);
                return;
            }
            this.logger.info('+', human._s(creator));

            await this.DispatchInner(creator.content.substring(this.prefix.length).split(/\s+/), creator);
        } else if (creator instanceof Discord.BaseInteraction) {
            if (creator.isChatInputCommand()) {
                await creator.deferReply();
                this.logger.info('+', human._s(creator));

                const tokens = [
                    creator.commandName,
                    creator.options.getSubcommandGroup(false),
                    creator.options.getSubcommand(false)
                ].filter(c => !!c);
                await this.DispatchInner(tokens, creator);
            } else if (creator.isSelectMenu()) {
                await creator.deferReply();
                await creator.reply({content: 'OwO whats this?'});
                this.logger.info('+', human._s(creator));
            } else if (creator.isButton()) {
                await creator.deferReply();
                this.logger.info('+', human._s(creator));
                // console.dir(creator);
                this.actionEmitter.emitOnButton(creator);
            }
        }
    }

    /**
     * Adds new available command
     * @param name name of the command
     * @param callback it should proccess command
     * @returns
     */
    public RegisterCommand(name: string | string[], callback: CommandCallback, options?: CommandCreationOptions): CommandParserService {
        if (Array.isArray(name)) {
            for (const n of name) {
                this.RegisterCommand(n, callback, options);
            }
            return this;
        }
        this.logger.debug(human._s(this), '+>', name);

        this.commands[name] = new RegisteredCommand({
            parser: this,
            name,
            callback,
            opts: options
        });

        return this;
    }

    /**
     * Adds a new available category
     * @param name name of subcategory
     * @param wrapper decorator for the target command (put checks and try/catch there)
     * @returns
     */
    public RegisterCategory(name: string, wrapper: CategoryWrapper | undefined = undefined, description: string | undefined = undefined): CommandParserService {
        this.logger.debug(human._s(this), '+>>', name);
        const category = new CommandParserService({wrapper, description});
        category.parent = this;
        category.name = name;
        this.categories[name] = category;
        return category;
    }

    /**
     * Adds command alias
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
            name: fromName,
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
                    description: cmd.Description,
                    options: cmd.Arguments?.map(c => {
                        return {
                            name: c.id,
                            description: c.description,
                            required: c.required,
                            type: ApplicationCommandOptionType.String,
                            choices: c.choices?.map(e => {
                                return {
                                    name: e,
                                    value: e,
                                };
                            })
                        };
                    })
                });
            }
            for (const cmd of Object.keys(parser.aliases).map(c => parser.aliases[c])) {
                parserCommands.push({
                    ...based,
                    name: cmd.name,
                    description: `alias: ${cmd.name} -> ${cmd.command.FullName}`,
                    options: cmd.command.Arguments?.map(c => {
                        return {
                            name: c.id,
                            description: c.description,
                            required: c.required,
                            type: ApplicationCommandOptionType.String,
                            choices: c.choices?.map(e => {
                                return {
                                    name: e,
                                    value: e,
                                };
                            })
                        };
                    })
                });
            }
            return parserCommands;
        };

        getParserCommands({type: ApplicationCommandType.ChatInput}, this).forEach(c => res.push(c));

        for (const subCategory of Object.keys(this.categories).map(c => this.categories[c])) {
            const opts: Discord.ApplicationCommandOptionData[] = [];
            opts.push(...(getParserCommands({type: ApplicationCommandType.ChatInput}, subCategory) as unknown as Discord.ApplicationCommandSubCommandData[]));
            for (const subSubCategory of Object.keys(subCategory.categories).map(c => subCategory.categories[c])) {
                opts.push({
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    name: subSubCategory.Name,
                    description: this.description,
                    options: getParserCommands({type: 1}, subSubCategory) as unknown as Discord.ApplicationCommandSubCommandData[]
                });
            }
            res.push({
                type: ApplicationCommandType.ChatInput,
                name: subCategory.Name,
                description: this.description,
                options: opts,
            });
        }

        this.logger.debug('Discord commands', JSON.stringify(res));

        return res;
    }

    public GetHelpMessage(): Discord.MessagePayload | Discord.BaseMessageOptions {
        return {
            embeds: [
                {
                    title: 'Help message for this bot',
                    description: `All command are available with **/** or with prefix **${this.prefix}**`,
                    fields: [
                        {
                            name: 'base',
                            value: `\`\`\`asciidoc\n${Object.keys(this.commands).map(c => `${this.commands[c].Name} :: ${this.commands[c].Description}`).join('\n')}\`\`\``
                        },
                        {
                            name: 'aliases',
                            value: `\`\`\`asciidoc\n${Object.keys(this.aliases).map(c => `${c} :: ${this.aliases[c].command.FullName}`).join('\n')}\`\`\``
                        },
                        // ...Object.keys(this.categories).map(c => {
                        //     return {
                        //         name: c,
                        //         value: this.categories[c].displayContent()
                        //     };
                        // }),
                        ...Object.keys(this.categories)
                            .map(c => {
                                return { title: c, blocks: this.categories[c].getDisplayContentBlocks() };
                            }).reduce((total, x) => {
                                let index = 1;
                                for (const item of x.blocks) {
                                    total.push({name: `${x.title}#${index++}`, value: item});
                                }
                                return total;
                            }, []),
                    ]
                }
            ]
        };
    }

    private getDisplayContentBlocks(spaces = 0): Array<string> {
        const res = new Array<string>();
        let i = 0;
        
        for (;;) {
            const keys = Object.keys(this.commands).slice(i * 10, (i + 1) * 10);
            if (keys.length === 0) break;

            const commands = {};
            for (const key of keys) {
                commands[key] = this.commands[key];
            }
            res.push(this.displayContent(commands, spaces));
            i++;
        }

        for (const k of Object.keys(this.categories)) {
            const cat = this.categories[k];
            const blocks = cat.getDisplayContentBlocks(spaces + 2);
            for (const block of blocks) {
                res.push(block);
            }
        }

        return res;
    }

    private displayContent(commands?: CommandCollection | undefined, spaces = 0): string {
        if (!commands) commands = this.commands;

        let s = '```asciidoc\n';
        for (const k of Object.keys(commands)) {
            const cmd = commands[k];
            s += ''.padEnd(spaces, ' ');
            s += cmd.Name;
            s += ' ';
            for (const arg of cmd.Arguments) {
                if (arg.required) {
                    s += '<';
                } else {
                    s += '[';
                }
                s += arg.id;
                if (arg.required) {
                    s += '>';
                } else {
                    s += ']';
                }
                s += ' ';
            }
            s += '\t::\t';
            s += cmd.Description;
            s += ' (';
            s += `${cmd.Arguments.map(c => `${c.id}=${c.description}`).join(', ')}`;
            s += ')\n';
        }

        s += '```';
        return s;
    }

    public async CreateSelectPromt(
        cmd: BaseCommand,
        options: string[],
        filter: (user: Discord.GuildMember, channel: Discord.TextChannel) => boolean,
        timeout = 60e3
    ): Promise<UserPromtResult> {
        if (!options || options.length < 1 || options.length > 10) {
            return new Promise((_, reject) => reject(new Error('Too much or too few options (must be in range [1:10])')));
        }

        options = options.map((c, i) => `${i+1}. ${c}`);
        const optToButton = (i: number): Discord.ButtonBuilder => {
            return new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                label: (i+1).toString(),
                customId: (i+1).toString(),
            });
        };
        const comps: ActionRowBuilder<ButtonBuilder>[] = [
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    options.filter((_, i) => i < 5).map((_, i) => optToButton(i))
                )
        ];
        if (options.length > 5) {
            comps.push(
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(options.filter((_, i) => i >= 5).map((_, i) => optToButton(i+5)))
            );
        }
        comps.push(new ActionRowBuilder<ButtonBuilder>()
            .addComponents(new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: 'Cancel',
                customId: 'cancel',
            })
        ));

        const promtMsg = await cmd.reply({
            content: `Select by sending message or clicking button:\n\`\`\`${options.join('\n')}\`\`\``,
            components: comps,
        });
        const res = await new Promise<UserPromtResult>((resolve) => {
            const handler = async (user: Discord.GuildMember, channel: Discord.TextChannel, result: UserPromtResult, creator: Discord.Message | Discord.ButtonInteraction) => {
                if (!filter(user, channel)) {
                    return;
                }
                clearTimeout(tmHandler);
                this.GrandParent.actionEmitter.removeListener('action', handler);
                if (creator) {
                    if (creator instanceof Discord.Message) {
                        await creator.delete();
                    } else if (creator instanceof Discord.ButtonInteraction) {
                        await creator.deleteReply();
                    }
                }
                resolve(result);
            };
            const tmHandler = setTimeout(() => {
                this.GrandParent.actionEmitter.removeListener('action', handler);
                resolve('timeout');
            }, timeout);
            this.GrandParent.actionEmitter.on('action', handler);
        });

        if (res === 'cancel') {
            await promtMsg.edit({content: 'Canceled 🚫', components: []});
        } else if (res === 'timeout') {
            await promtMsg.edit({content: 'Timeout ♻', components: []});
        } else {
            await promtMsg.edit({content: `Selected **${options[res - 1]}**`, components: []});
        }

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

        const cmd = tokens.shift().toLowerCase();

        const aliasCmd = this.aliases[cmd];
        const catCmd = this.categories[cmd];
        const cmdCmd = this.commands[cmd];

        if (aliasCmd) {
            this.logger.debug(human._s(this), '}', cmd);
            await aliasCmd.command.Parser.execute(aliasCmd.command.Name, this.validateCommand(creator, aliasCmd.command, aliasCmd));
        } else if (catCmd) {
            this.logger.debug(human._s(this), '>>', cmd);
            await catCmd.DispatchInner(tokens, creator);
        } else if (cmdCmd) {
            this.logger.debug(human._s(this), '>', cmd);
            await this.execute(cmdCmd.Name, this.validateCommand(creator, cmdCmd));
        }
    }

    /**
     * Executes registered command
     * @param cmd command name
     * @param postfix rest of argument
     * @param original original message
     */
    private async execute(cmd: string, creator: BaseCommand): Promise<void> {
        if (!creator) {
            return;
        }

        if (this.wrapper) {
            await this.wrapper(creator, this.commands[cmd].Callback);
        } else {
            await this.commands[cmd].Callback(creator);
        }
    }

    private validateCommand(creator: Discord.Message | Discord.CommandInteraction, command: RegisteredCommand, commandAlias?: CommandAlias): BaseCommand | undefined {
        let res: BaseCommand;
        const cmdParams: CommandParamCollection = {};

        if (creator instanceof Discord.Message) {
            let text = creator.content;
            // text = text.split(/s+/g).filter((c, i) => i >= commandAlias?.)
            text = text.replace(/\s+/g, ' ');
            text = text.substring(this.GrandParent.prefix.length + (commandAlias?.name.length ?? command.FullName.length));

            const nextToken = (s: string): [string, string] => {
                if (!s) {
                    return ['', ''];
                }
                s = s.replace(/^\s/, '');
                if (s.charAt(0) === '"') {
                    const end = s.indexOf('"', 1);
                    if (end === -1) {
                        throw new Error('No closing "');
                    }
                    return [s.substring(1, end), s.substring(end+1)];
                } else if (s.charAt(0) === '\'') {
                    const end = s.indexOf('\'', 1);
                    if (end === -1) {
                        throw new Error('No closing \'');
                    }
                    return [s.substring(1, end), s.substring(end+1)];
                }
                const end = s.indexOf(' ');
                if (end === -1) {
                    return [s, ''];
                }
                return [s.substring(0, end), s.substring(end+1)];
            };

            for (const opt of command.Arguments) {
                let val: string | undefined = undefined;
                try {
                    [val, text] = nextToken(text);
                } catch (e) {
                    (creator.channel as ActualTextChannel).send({content: `Invalid command: ${(e as Error).message}`});
                    return undefined;
                }
                if (val) {
                    if (opt.choices) {
                        if (!opt.choices.some(c => c === val)) {
                            (creator.channel as ActualTextChannel).send({content: `Invalid argument value, valid are:[${opt.choices.join(', ')}]`});
                            return undefined;
                        }
                    }
                    // if last argument
                    if (command.Arguments.findIndex(c => c.id === opt.id) === command.Arguments.length - 1) {
                        val += ' ' + text;
                        val = val.trim();
                    }
                    cmdParams[opt.id] = {
                        id: opt.id,
                        value: val,
                    };
                } else if (opt.required) {
                    if (opt.default) {
                        cmdParams[opt.id] = {
                            id: opt.id,
                            value: opt.default
                        };
                    } else {
                        (creator.channel as ActualTextChannel).send({content: `Missing argument ${opt.id}`});
                        return undefined;
                    }
                }
            }

            res = new MessageCommand({
                cmdParser: this,
                user: creator.member,
                message: creator,
                params: cmdParams,
            });
        } else if (creator instanceof Discord.CommandInteraction) {
            // not supported (yet?)
            if (!(creator.member instanceof Discord.GuildMember)) {
                return undefined;
            }

            for (const opt of command.Arguments) {
                const val = creator.options.get(opt.id, false)?.value.toString();
                if (val) {
                    cmdParams[opt.id] = {
                        id: opt.id,
                        value: val,
                    };
                } else if (opt.required) {
                    if (opt.default) {
                        cmdParams[opt.id] = {
                            id: opt.id,
                            value: opt.default
                        };
                    } else {
                        creator.reply({content: `Missing argument ${opt.id}`});
                        return undefined;
                    }
                }
            }

            res = new InteractionCommand({
                cmdParser: this,
                user: creator.member,
                interaction: creator,
                params: cmdParams,
            });
        }

        return res;
    }

    private checkRegistered(name: string): boolean {
        return !!this.commands[name] || !!this.categories[name] || !!this.aliases[name] || false;
    }
}

export default CommandParserService;
