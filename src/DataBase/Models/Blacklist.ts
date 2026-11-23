import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

interface BlacklistAttributes {
    userId: string;
    guildId: string;
    reason: string;
    bannedBy: string;
    bannedAt: Date;
    until: Date | null;
}

interface BlacklistCreationAttributes
    extends Optional<BlacklistAttributes, 'bannedAt' | 'until'> { }

export interface BlacklistInstance
    extends Model<BlacklistAttributes, BlacklistCreationAttributes>, BlacklistAttributes { }

const Blacklist = sequelize.define<BlacklistInstance>(
    'blacklist',
    {
        userId: { field: 'user_id', type: DataTypes.STRING, primaryKey: true },
        guildId: { field: 'guild_id', type: DataTypes.STRING, primaryKey: true },
        reason: { field: 'reason', type: DataTypes.STRING, allowNull: false },
        bannedBy: { field: 'banned_by', type: DataTypes.STRING, allowNull: false },
        bannedAt: { field: 'banned_at', type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        until: { field: 'until', type: DataTypes.DATE, allowNull: true },
    }
);

export default Blacklist;
