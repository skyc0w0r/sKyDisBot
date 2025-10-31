import { Message } from 'discord.js';
import { MessageCommandData } from '../../Interface/CommandParserInterface.js';
import { BaseCommand } from './index.js';

export class MessageCommand extends BaseCommand {
    public get Message(): Message {
        return this.message;
    }

    private message: Message;

    constructor(data: MessageCommandData) {
        super(data);
        this.message = data.message;
    }
}
