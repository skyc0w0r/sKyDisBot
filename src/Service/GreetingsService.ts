import { ChannelType, PermissionsBitField, VoiceState } from 'discord.js';
import Logger from 'log4js';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import CommandParserService from './CommandParserService.js';
import { GlobalServiceManager } from './ServiceManager.js';
import DataBaseService from './DataBaseService.js';
import human from '../human.js';
import DiscordEventerService from './DiscordEventerService.js';

const logger = Logger.getLogger('greeter');
const GREETING_TIMEOUT = 5 * 60 * 1000;

class GreetingsService extends BaseService {
    private db: DataBaseService;

    public async Init(): Promise<void> {
        this.db = GlobalServiceManager().GetRequiredService(DataBaseService);
        GlobalServiceManager().GetRequiredService(DiscordEventerService)
            .Notify.on('voiceStateUpdate', (a, b) => this.onVoiceUpdate(a, b))
        const cp = GlobalServiceManager().GetRequiredService(CommandParserService);

        cp.RegisterCommand('gif', (c) => this.gifAdd(c), {
            description: 'Subscribing to a channel join event so that the bot sends a GIF',
            options: [
                {
                    id: 'discordId',
                    description: 'Nickname user',
                    required: true,
                },
                {
                    id: 'gif',
                    description: 'Link for GIF',
                    required: true,
                },
            ],

        });
        cp.RegisterCommand('gif_change', (c) => this.gifChange(c), {
            description: 'Change gif for user',
            options: [
                {
                    id: 'discordId',
                    description: 'Nickname user',
                    required: true,
                },
                {
                    id: 'gif',
                    description: 'Link for GIF',
                    required: true,
                },
            ],

        });
        cp.RegisterCommand('gif_remove', (c) => this.gifRemove(c), {
            description: 'Remove gif for user',
            options: [
                {
                    id: 'discordId',
                    description: 'Nickname user',
                    required: true,
                },
            ],
        });
        cp.RegisterCommand('gif_list', (c) => this.gifList(c), {
            description: 'List all gifs',
        });
    }

    private async onVoiceUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
        if (!(!oldState?.channel && !!newState?.channel)) return;

        try {
            const user = await this.db.GifGetOne(newState.member.user.id, newState.guild.id);

            if (!user) return;

            if (!!user.lastSent && new Date().valueOf() - user.lastSent.valueOf() < GREETING_TIMEOUT) return;

            const textChannel = newState.channel.guild.channels.cache
                .filter((c) => c.type === ChannelType.GuildText)
                .first();

            textChannel.send({
                embeds: [
                    {
                        title: `Кто это тут зашел? Ну привет, ${newState.member.user.username}`,
                        image: {
                            url: user.gif,
                        },
                        color: Math.floor(Math.random() * 16777215),
                    },
                ],
            });

            await user.update({ 'lastSent': new Date() });

        } catch (e) {
            logger.error(e);
        }
    }

    // Add new Record to DB
    private async gifAdd(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await cmd.reply({ content: 'Command only for moderators' });
            return;
        }

        const userId = this.extractUserId(cmd.Params['discordId'].value);

        if (!userId) {
            await cmd.reply({ content: 'Invalid discord id' });
            return;
        }

        const status = await this.db.GifSet(userId, cmd.Guild.id, cmd.Params['gif'].value);

        await cmd.reply({ content: status });

        logger.info(human._s(cmd.User), `set gif to user`, human._s(cmd.Guild.members.resolve(userId)));
    }

    // change gif for user
    private async gifChange(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await cmd.reply({ content: 'Command only for moderators' });
            return;
        }

        const userId = this.extractUserId(cmd.Params['discordId'].value);

        if (!userId) {
            await cmd.reply({ content: 'Invalid discord id' });
            return;
        }

        const status = await this.db.GifUpdate(userId, cmd.Guild.id, cmd.Params['gif'].value);

        await cmd.reply({ content: status });

        logger.info(human._s(cmd.User), `updated gif to user`, human._s(cmd.Guild.members.resolve(userId)));
    }

    // Remove gif for user
    private async gifRemove(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await cmd.reply({ content: 'Command only for moderators' });
            return;
        }

        const userId = this.extractUserId(cmd.Params['discordId'].value);

        if (!userId) {
            await cmd.reply({ content: 'Invalid discord id' });
            return;
        }

        const status = await this.db.GifRemove(userId, cmd.Guild.id);

        await cmd.reply({ content: status });
        
        logger.info(human._s(cmd.User), `removed gif from user`, human._s(cmd.Guild.members.resolve(userId)));
    }

    private async gifList(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await cmd.reply({ content: 'Command only for moderators' });
            return;
        }

        const userList = await this.db.GifGet(cmd.Guild.id);

        await cmd.reply({
            embeds: [
                {
                    title: `List gifs for ${cmd.Guild.name}`,
                    color: Math.floor(Math.random() * 16777215),
                    fields: userList.reduce((acc, u) => {
                        return [...acc, {
                            name: 'User',
                            value: `<@!${u.userId}>`,
                            inline: true,
                        },
                        {
                            name: 'Gif',
                            value: u.gif,
                            inline: true,
                        },
                        {
                            name: 'Last sent',
                            value: u?.lastSent ? u.lastSent.toISOString() : '-',
                            inline: true,
                        },
                        {
                            name: '\u200b',
                            value: '\u200b',
                            inline: false,
                        },];
                    }, [])
                },
            ],
        });
    }

    public async Destroy(): Promise<void> {
    }

    extractUserId(raw: string): string | undefined {
        const matches = /^<@(?<user_id>\d+)>$/.exec(raw);
        return matches?.groups?.user_id
    }
}

export default GreetingsService;
