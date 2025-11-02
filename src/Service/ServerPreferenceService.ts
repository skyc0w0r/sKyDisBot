import { BaseService } from "../Interface/ServiceManagerInterface.js";
import Logger from 'log4js';
import DataBaseService from "./DataBaseService.js";
import { GlobalServiceManager } from "./ServiceManager.js";
import CommandParserService from "./CommandParserService.js";
import { BaseCommand } from "../Model/CommandParser/index.js";
import { ChannelType, PermissionsBitField } from "discord.js";
import human from "../human.js";
import { GIF_CHANNEL, GIF_ENABLE } from "../Helpers/ServerPreferenceNames.js";

class ServerPreferenceService extends BaseService {
    private logger: Logger.Logger;
    private db: DataBaseService;

    constructor() {
        super();
        this.logger = Logger.getLogger('audio_manager');
    }

    async Init(): Promise<void> {
        let cp = GlobalServiceManager().GetRequiredService(CommandParserService);
        this.db = GlobalServiceManager().GetRequiredService(DataBaseService);

        cp = cp.RegisterCategory('settings', undefined, 'Bot settings');

        cp.RegisterCommand('gif_enable', this.SetGifEnable.bind(this), {
            description: 'Enable gif greetigns?',
            options: [{
                id: 'toggle',
                description: 'yes/no',
                choices: ['yes', 'no'],
                required: false,
            }],
        });
        cp.RegisterCommand('gif_channel', this.SetGifChannel.bind(this), {
            description: 'Channel for gif greetings',
            options: [{
                id: 'channel_id',
                description: 'Where should bot send gifs',
                required: false,
            }],
        });
    }
    
    async Destroy(): Promise<void> {
    }

    private async SetGifEnable(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await cmd.reply({ content: 'Command only for moderators' });
            return;
        }

        const valueRaw = cmd.Params['toggle']?.value;
        if (!valueRaw) {
            const currentPreference = await this.db.ServerPreference.Get(cmd.Guild.id, GIF_ENABLE);
            const status = currentPreference ? 'enabled' : 'disabled';
            await cmd.reply({ content: `Gif greetings are **${status}** on this server` });
            return;
        }
        const value = valueRaw === 'yes' || valueRaw === 'true' || valueRaw === '1';

        await this.db.ServerPreference.Set(cmd.Guild.id, GIF_ENABLE, value.toString());

        const newStatus = value ? 'enabled' : 'disabled';
        await cmd.reply({ content: `You ${newStatus} gif greetings on this server 👌` });

        this.logger.info(human._s(cmd.Guild), 'Set gif enabled/disabled by', human._s(cmd.User));
    }

    private async SetGifChannel(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await cmd.reply({ content: 'Command only for moderators 😫' });
            return;
        }

        const valueRaw = cmd.Params['channel_id']?.value;
        if (!valueRaw) {
            const currentChannelId = await this.db.ServerPreference.Get(cmd.Guild.id, GIF_CHANNEL);
            if (!currentChannelId) {
                await cmd.reply({ content: 'This server have not set gif channel 😝' });
            } else {
                await cmd.reply({ content: `Gifs will be sent to <#${currentChannelId}>` });
            }
            return
        }

        const channelId = this.extractChannelId(valueRaw);
        if (!channelId) {
            await cmd.reply({ content: 'Invalid channel id 🤯' });
            return;
        }

        const channel = await cmd.Guild.channels.fetch(channelId);
        if (!channel || channel.type !== ChannelType.GuildText) {
            await cmd.reply({ content: 'Invalid channel id 😡' });
            return;
        }

        await this.db.ServerPreference.Set(cmd.Guild.id, GIF_CHANNEL, channelId);
        await cmd.reply({ content: `You set gif greetings to <#${channel.id}> 👌` })

        this.logger.info(human._s(cmd.Guild), 'Set gif channel to', human._s(channel), 'by', human._s(cmd.User));
    }

    extractChannelId(raw: string): string | undefined {
        const matches = /^<#(?<channel_id>\d+)>$/.exec(raw);
        return matches?.groups?.channel_id
    }
}

export default ServerPreferenceService;
