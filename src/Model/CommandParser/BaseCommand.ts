import Discord from 'discord.js';
import { BaseCommandData } from '../../Interface/CommandParserInterface.js';
import { InteractionCommand, MessageCommand } from './index.js';

export class BaseCommand {
    public get User(): Discord.GuildMember {
        return this.user;
    }
    public get Channel(): Discord.TextBasedChannels {
        return this.channel;
    }

    private user: Discord.GuildMember;
    private channel: Discord.TextBasedChannels;

    constructor(data: BaseCommandData) {
        this.user = data.user;
        this.channel = data.channel;
    }

    public isByMessage(): this is MessageCommand {
        return this instanceof MessageCommand;
    }
    public isByInteraction(): this is InteractionCommand {
        return this instanceof InteractionCommand;
    }
}
