import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionsBitField } from 'discord.js';
import Logger from 'log4js';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import CommandParserService from './CommandParserService.js';
import { GlobalServiceManager } from './ServiceManager.js';
import DataBaseService from './DataBaseService.js';
import human from '../human.js';
import { BlacklistEntry, RenderBlacklist } from '../Helpers/BlacklistCanvas.js';
import { parseDuration } from '../Helpers/DurationParser.js';

const PAGE_SIZE = 15;
const PAGINATION_TIMEOUT = 5 * 60 * 1000;
const PREV_BUTTON = 'blacklist_prev';
const NEXT_BUTTON = 'blacklist_next';

interface GuildListCache {
    key: string;
    pages: Buffer[];
}

class BlacklistService extends BaseService {
    private logger: Logger.Logger;
    private db: DataBaseService;
    private listCache = new Map<string, GuildListCache>();

    constructor() {
        super();
        this.logger = Logger.getLogger('blacklist');
    }

    public async Init(): Promise<void> {
        this.db = GlobalServiceManager().GetRequiredService(DataBaseService);
        let cp = GlobalServiceManager().GetRequiredService(CommandParserService);

        cp = cp.RegisterCategory('blacklist', undefined, 'Blacklisted users');

        cp.RegisterCommand('ban', this.Ban.bind(this), {
            description: 'Ban a user from using the bot on this server',
            options: [
                {
                    id: 'user_id',
                    description: 'User to ban',
                    required: true,
                },
                {
                    id: 'duration',
                    description: 'Ban duration, e.g. 1d or 2w3d5h, 0 for permanent',
                    required: true,
                },
                {
                    id: 'reason',
                    description: 'Ban reason',
                    required: true,
                },
            ],
        });
        cp.RegisterCommand('unban', this.Unban.bind(this), {
            description: 'Unban a user',
            options: [
                {
                    id: 'user_id',
                    description: 'User to unban',
                    required: true,
                },
            ],
        });
        cp.RegisterCommand('list', this.List.bind(this), {
            description: 'Show the blacklist for this server',
        });
    }

    public async Destroy(): Promise<void> {
    }

    private async Ban(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await cmd.reply({ content: 'Command only for moderators' });
            return;
        }

        const userId = this.extractUserId(cmd.Params['user_id'].value);

        if (!userId) {
            await cmd.reply({ content: 'Invalid discord id' });
            return;
        }

        const durationMs = parseDuration(cmd.Params['duration'].value);
        if (durationMs === undefined) {
            await cmd.reply({ content: 'Invalid duration, use e.g. 1d or 2w3d5h (0 for permanent)' });
            return;
        }
        const until = durationMs === null ? null : new Date(Date.now() + durationMs);

        const status = await this.db.Blacklist.Ban(userId, cmd.Guild.id, cmd.Params['reason'].value, cmd.User.id, until);

        await cmd.reply({ content: status });

        this.logger.info(human._s(cmd.User), 'banned', userId, 'on', human._s(cmd.Guild));
    }

    private async Unban(cmd: BaseCommand): Promise<void> {
        if (!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await cmd.reply({ content: 'Command only for moderators' });
            return;
        }

        const userId = this.extractUserId(cmd.Params['user_id'].value);

        if (!userId) {
            await cmd.reply({ content: 'Invalid discord id' });
            return;
        }

        const status = await this.db.Blacklist.Unban(userId, cmd.Guild.id);

        await cmd.reply({ content: status });

        this.logger.info(human._s(cmd.User), 'unbanned', userId, 'on', human._s(cmd.Guild));
    }

    private async List(cmd: BaseCommand): Promise<void> {
        const banned = await this.db.Blacklist.Get(cmd.Guild.id);

        if (banned.length === 0) {
            await cmd.reply({ content: 'No one is banned on this server 👌' });
            return;
        }

        // permanent bans (no until date) first, then longest remaining first
        banned.sort((a, b) => {
            if (a.until === null && b.until === null) return 0;
            if (a.until === null) return -1;
            if (b.until === null) return 1;
            return b.until.getTime() - a.until.getTime();
        });

        const entries: BlacklistEntry[] = await Promise.all(banned.map(async (b) => {
            const member = await cmd.Guild.members.fetch(b.userId).catch(() => undefined);
            return {
                username: member?.displayName ?? b.userId,
                reason: b.reason,
                expired: b.until !== null && b.until.getTime() <= Date.now(),
            };
        }));

        const pages = await this.getOrRenderPages(cmd.Guild.id, entries);

        if (pages.length === 1) {
            await cmd.reply({ files: [new AttachmentBuilder(pages[0], { name: 'blacklist.png' })] });
            return;
        }

        let page = 0;
        const message = await cmd.reply({
            files: [new AttachmentBuilder(pages[page], { name: 'blacklist.png' })],
            components: [this.buildPaginationRow(page, pages.length)],
        });

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: PAGINATION_TIMEOUT,
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== cmd.User.id) {
                await interaction.reply({ content: 'Only the person who ran the command can flip pages', ephemeral: true });
                return;
            }

            page += interaction.customId === NEXT_BUTTON ? 1 : -1;
            await interaction.update({
                files: [new AttachmentBuilder(pages[page], { name: 'blacklist.png' })],
                components: [this.buildPaginationRow(page, pages.length)],
            });
        });

        collector.on('end', async () => {
            await message.edit({ components: [] }).catch(() => undefined);
        });
    }

    // Renders one page per PAGE_SIZE entries, reusing the previous render for
    // this guild as long as the underlying data (and expiry status) hasn't changed.
    private async getOrRenderPages(guildId: string, entries: BlacklistEntry[]): Promise<Buffer[]> {
        const key = JSON.stringify(entries);
        const cached = this.listCache.get(guildId);
        if (cached && cached.key === key) {
            return cached.pages;
        }

        const pageCount = Math.ceil(entries.length / PAGE_SIZE);
        const pages = await Promise.all(
            Array.from({ length: pageCount }, (_, i) => entries.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE))
                .map((pageEntries) => RenderBlacklist(pageEntries))
        );

        this.listCache.set(guildId, { key, pages });
        return pages;
    }

    private buildPaginationRow(page: number, pageCount: number): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                emoji: '⬅️',
                customId: PREV_BUTTON,
                disabled: page === 0,
            }),
            new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: `${page + 1}/${pageCount}`,
                customId: 'blacklist_page',
                disabled: true,
            }),
            new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                emoji: '➡️',
                customId: NEXT_BUTTON,
                disabled: page === pageCount - 1,
            }),
        );
    }

    extractUserId(raw: string): string | undefined {
        const matches = /^<@(?<user_id>\d+)>$/.exec(raw);
        return matches?.groups?.user_id;
    }
}

export default BlacklistService;
