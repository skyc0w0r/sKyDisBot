import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Optional } from "sequelize";
import { sequelize } from "../index.js";
import AudioTrackAudit from "./AudioTrackAudit.js";
import { TRACK_TYPE_ENUM, TrackType } from "../../Enums/TrackType.js";

// https://sequelize.org/docs/v6/other-topics/typescript/
class AudioTrack extends Model<InferAttributes<AudioTrack>, InferCreationAttributes<AudioTrack>> {
    declare id: CreationOptional<number>;
    declare serviceType: TrackType;
    declare serviceId: string;
    declare title: string;
    declare duration: number;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

AudioTrack.init({
    id: { field: 'id', type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    serviceType: { field: 'track_type', type: DataTypes.ENUM, values: Object.keys(TRACK_TYPE_ENUM), allowNull: false },
    serviceId: { field: 'service_id', type: DataTypes.STRING, allowNull: false },
    title: { field: 'title', type: DataTypes.STRING, allowNull: false },
    duration: { field: 'duration', type: DataTypes.INTEGER, allowNull: false },

    createdAt: { field: 'created_at', type: DataTypes.DATE },
    updatedAt: { field: 'updated_at', type: DataTypes.DATE },
}, {
    tableName: 'audio_tracks',
    sequelize,
});

AudioTrack.hasMany<AudioTrack, AudioTrackAudit>(AudioTrackAudit, {
    sourceKey: 'id',
    foreignKey: 'track_id',
    as: 'audits',
});
AudioTrackAudit.belongsTo<AudioTrackAudit, AudioTrack>(AudioTrack, {
    as: 'track',
});

export default AudioTrack;
