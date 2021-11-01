import Discord from 'discord.js';
import { InteractionCommandData } from '../../Interface/CommandParserInterface.js';
import { BaseCommand } from './index.js';

export class InteractionCommand extends BaseCommand {
    public get Interaction(): Discord.CommandInteraction {
        return this.interaction;
    } 

    private interaction: Discord.CommandInteraction;

    constructor(data: InteractionCommandData) {
        super(data);
        this.interaction = data.interaction;
    }
}
