import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index.js";

class ServerPreference extends Model<InferAttributes<ServerPreference>, InferCreationAttributes<ServerPreference>> {
    declare id: CreationOptional<number>;
    declare guildId: string;
    declare name: string;
    declare value: string;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

ServerPreference.init({
    id: { field: 'id', type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    guildId: { field: 'guild_id', type: DataTypes.STRING, allowNull: false },
    name: { field: 'name', type: DataTypes.STRING, allowNull: false },
    value: { field: 'value', type: DataTypes.STRING, allowNull: false },

    createdAt: { field: 'created_at', type: DataTypes.DATE },
    updatedAt: { field: 'updated_at', type: DataTypes.DATE },
}, {
    tableName: 'server_preferences',
    sequelize,
});

export default ServerPreference;
