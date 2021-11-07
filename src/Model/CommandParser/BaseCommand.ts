import Discord from 'discord.js';
import { BaseCommandData } from '../../Interface/CommandParserInterface.js';
import { CommandParamCollection } from './CommandOption.js';
import { InteractionCommand, MessageCommand } from './index.js';

export class BaseCommand {
    public get User(): Discord.GuildMember {
        return this.user;
    }
    public get Channel(): Discord.TextBasedChannels {
        if (this.isByInteraction()) {
            return this.Interaction.channel;
        }
        if (this.isByMessage()) {
            return this.Message.channel;
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

    private user: Discord.GuildMember;
    private params: CommandParamCollection;

    constructor(data: BaseCommandData) {
        this.user = data.user;
        this.params = data.params;
    }

    public isByMessage(): this is MessageCommand {
        return this instanceof MessageCommand;
    }
    public isByInteraction(): this is InteractionCommand {
        return this instanceof InteractionCommand;
    }

    public async reply(content: Discord.MessagePayload | Discord.MessageOptions): Promise<void> {
        if (this.isByMessage()) {
            await this.Channel.send(content);
        } else if (this.isByInteraction()) {
            await this.Interaction.followUp({...content});
        }
    }
}
