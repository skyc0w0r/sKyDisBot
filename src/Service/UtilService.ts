import Logger from 'log4js';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import CommandParserService from './CommandParserService.js';
import { GlobalServiceManager } from './ServiceManager.js';
import human from '../human.js';

export default class UtilService extends BaseService {
    private logger: Logger.Logger;

    constructor() {
        super();

        this.logger = Logger.getLogger('util');
    }

    Init(): void | Promise<void> {
        let cp = GlobalServiceManager().GetService(CommandParserService);
        if (!cp) {
            throw new Error('Where is my CommandParser?');
        }
        cp = cp.RegisterCategory('util');
        cp.RegisterCommand('purge', (c) => this.purge(c), {
            description: 'Purge messages',
            options: [
                {
                    id: 'user_id',
                    description: 'Purge only messages from user',
                    required: false,
                },
                {
                    id: 'count',
                    description: 'Purge only this much messages',
                    default: '50',
                }
            ]
        });
    }
    Destroy(): void | Promise<void> {
        //
    }

    private async purge(cmd: BaseCommand): Promise<void> {
        const userIdRaw = cmd.Params['user_id']?.value;
        const userId = userIdRaw && userIdRaw.substring(2, userIdRaw.length - 1) || null;
        const userInfo = userId && await cmd.Guild.members.fetch({user: userId});

        const cntRaw = cmd.Params['count']?.value;
        const cnt = cntRaw && parseInt(cntRaw) || -1;

        this.logger.info('Deleting', cnt || 'all', 'messages from', userInfo && human._s(userInfo) || 'all users', 'in', human._s(cmd.Channel));

        const msgs = await cmd.Channel.messages.fetch({ limit:  100 });
        let deleted = 0;
        for (const m of msgs) {
            const msgAuthor = m[1]?.member?.id || m[1]?.author?.id || null;
            if (userId && msgAuthor !== userId) continue;
            await m[1].delete();

            if (++deleted >= cnt) break;
        }

        this.logger.info('Deleting complete!');

        if (cmd.isByMessage()) {
            await cmd.Message.delete();
        } else if (cmd.isByInteraction()) {
            await cmd.Interaction.reply({ephemeral: true, content: 'Done!'});
        }
    }
}
