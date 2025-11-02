import { Association, CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Optional } from "sequelize";
import { sequelize } from "../index.js";
import AudioTrack from "./AudioTrack.js";

class AudioTrackAudit extends Model<InferAttributes<AudioTrackAudit, { omit: 'track' }>, InferCreationAttributes<AudioTrackAudit, { omit: 'track' }>> {
    declare id: CreationOptional<number>;
    declare trackId: ForeignKey<AudioTrack['id']>;
    declare userId: string;
    declare guildId: string;

    declare track: NonAttribute<AudioTrack>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare static associations: {
        track: Association<AudioTrackAudit, AudioTrack>;
    };
}

AudioTrackAudit.init({
    id: { field: 'id', type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    trackId: { field: 'track_id', type: DataTypes.INTEGER, allowNull: false },
    userId: { field: 'user_id', type: DataTypes.STRING, allowNull: false },
    guildId: { field: 'guild_id', type: DataTypes.STRING, allowNull: false },

    createdAt: { field: 'created_at', type: DataTypes.DATE },
    updatedAt: { field: 'updated_at', type: DataTypes.DATE },
}, {
    tableName: 'audio_track_audits',
    sequelize
})

export default AudioTrackAudit;
