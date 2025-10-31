import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../index.js";

interface UsersGifAttributes {
    userId: string;
    guildId: string;
    gif: string;
    lastSent: Date;
}

interface UsersGifCreationAttributes
    extends Optional<UsersGifAttributes, 'lastSent'> { }

export interface UsersGifInstance
    extends Model<UsersGifAttributes, UsersGifCreationAttributes>, UsersGifAttributes { }

const UsersGif = sequelize.define<UsersGifInstance>(
    'users_gifs',
    {
        userId: { field: 'user_id', type: DataTypes.STRING, primaryKey: true },
        guildId: { field: 'guild_id', type: DataTypes.STRING, primaryKey: true },
        gif: { field: 'gif', type: DataTypes.STRING, allowNull: false },
        lastSent: { field: 'last_sent', type: DataTypes.DATE, allowNull: true }
    }
);

export default UsersGif;
