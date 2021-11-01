import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import CommandParserService from './CommandParserService.js';
import { GlobalServiceManager } from './ServiceManager.js';

class AudioManagerService extends BaseService {
    constructor() {
        super();
        
        let cp = GlobalServiceManager().GetService(CommandParserService);
        if (!cp) {
            throw new Error('Where is my CommandParser?');
        }
        cp = cp.RegisterCategory('audio');
        cp.RegisterCommand('play', (c) => this.play(c));
    }

    private async play(cmd: BaseCommand): Promise<void> {
        if (cmd.isByMessage()) {
            await cmd.Channel.send({ content: 'I will now play music' });
        } else if (cmd.isByInteraction()) {
            await cmd.Interaction.reply({ content: 'I will now play music' });
        }
    }
}

export default AudioManagerService;
