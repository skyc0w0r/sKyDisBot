import { CommandInteraction } from 'discord.js';
import { InteractionCommandData } from '../../Interface/CommandParserInterface.js';
import { BaseCommand } from './index.js';

export class InteractionCommand extends BaseCommand {
    public get Interaction(): CommandInteraction {
        return this.interaction;
    } 

    private interaction: CommandInteraction;

    constructor(data: InteractionCommandData) {
        super(data);
        this.interaction = data.interaction;
    }
}
