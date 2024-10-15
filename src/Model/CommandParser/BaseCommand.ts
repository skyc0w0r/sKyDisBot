import Discord from 'discord.js';
import { BaseCommandData } from '../../Interface/CommandParserInterface.js';
import { UserPromtResult } from '../../Interface/UserPromtResult.js';
import CommandParserService from '../../Service/CommandParserService.js';
import { CommandParamCollection } from './CommandOption.js';
import { InteractionCommand, MessageCommand } from './index.js';
import { ActualTextChannel } from '../../Interface/Util.js';

export class BaseCommand {
    public get User(): Discord.GuildMember {
        return this.user;
    }
    public get Channel(): ActualTextChannel {
        if (this.isByInteraction()) {
            return this.Interaction.channel as ActualTextChannel;
        }
        if (this.isByMessage()) {
            return this.Message.channel as ActualTextChannel;
        }
        return undefined;
    }
    public get Params(): CommandParamCollection {
        return this.params;
    }
    public get Guild(): Discord.Guild {
        if (this.isByInteraction()) {
            return this.Interaction.guild;
        }
        if (this.isByMessage()) {
            return this.Message.guild;
        }
        return undefined;
    }

    private cmdParser: CommandParserService;
    private user: Discord.GuildMember;
    private params: CommandParamCollection;

    constructor(data: BaseCommandData) {
        this.cmdParser = data.cmdParser;
        this.user = data.user;
        this.params = data.params;
    }

    public isByMessage(): this is MessageCommand {
        return this instanceof MessageCommand;
    }
    public isByInteraction(): this is InteractionCommand {
        return this instanceof InteractionCommand;
    }

    public async CreateSelectPromt(
        options: string[],
        filter: (user: Discord.GuildMember, channel: Discord.TextChannel) => boolean,
        timeout = 60e3,
    ): Promise<UserPromtResult> {
        return await this.cmdParser.CreateSelectPromt(this, options, filter, timeout);
    }

    public async reply(content: Discord.MessagePayload | Discord.BaseMessageOptions): Promise<Discord.Message> {
        if (this.isByMessage()) {
            return await this.Channel.send(content);
        } else if (this.isByInteraction()) {
            if (new Date().getTime() - this.Interaction.createdAt.getTime() < 15 * 60 * 1000) {
                return await this.Interaction.followUp(content) as Discord.Message;
            } else {
                return await this.Interaction.channel.send(content);
            }
        }
        return undefined;
    }
}
