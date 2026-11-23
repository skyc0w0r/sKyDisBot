import { Op } from 'sequelize';
import Blacklist, { BlacklistInstance } from '../Models/Blacklist.js';

class BlacklistContext {
    public async Ban(userId: string, guildId: string, reason: string, bannedBy: string, until: Date | null): Promise<string> {
        const existing = await Blacklist.findOne({
            where: { userId: userId, guildId: guildId },
        });

        if (existing) {
            await existing.update({
                reason: reason,
                bannedBy: bannedBy,
                bannedAt: new Date(),
                until: until,
            });

            return 'Successfully updated the ban for user!';
        }

        await Blacklist.create({
            userId: userId,
            guildId: guildId,
            reason: reason,
            bannedBy: bannedBy,
            until: until,
        });

        return 'Successfully banned user from using the bot!';
    }

    public async Unban(userId: string, guildId: string): Promise<string> {
        const existing = await Blacklist.findOne({
            where: { userId: userId, guildId: guildId },
        });

        if (!existing) {
            return 'User is not banned on this server!';
        }

        await existing.destroy();

        return 'Successfully unbanned user!';
    }

    public async IsBanned(userId: string, guildId: string): Promise<BlacklistInstance | null> {
        const existing = await Blacklist.findOne({
            where: {
                userId: userId,
                guildId: guildId,
                [Op.or]: [{ until: null }, { until: { [Op.gt]: new Date() } }],
            },
        });

        return existing;
    }

    public async Get(guildId: string): Promise<BlacklistInstance[]> {
        const banned = await Blacklist.findAll({
            where: { guildId: guildId },
        });

        return banned;
    }
}

export default BlacklistContext;
