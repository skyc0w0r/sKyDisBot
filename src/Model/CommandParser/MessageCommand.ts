import Discord from 'discord.js';
import { MessageCommandData } from '../../Interface/CommandParserInterface.js';
import { BaseCommand } from './index.js';

export class MessageCommand extends BaseCommand {
    public get Message(): Discord.Message {
        return this.message;
    }

    private message: Discord.Message;

    constructor(data: MessageCommandData) {
        super(data);
        this.message = data.message;
    }
}
