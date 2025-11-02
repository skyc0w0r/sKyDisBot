import { TRACK_TYPE_ENUM } from "../../Enums/TrackType.js";
import { AudioMetaInfo } from "../../Model/AudioConverter/AudioMetaInfo.js";
import { AudioTrack as Media } from "../../Model/AudioManager/AudioTrack.js";
import { WebTrack } from "../../Model/AudioManager/WebTrack.js";
import { sequelize } from "../index.js";
import AudioTrack from "../Models/AudioTrack.js";
import AudioTrackAudit from "../Models/AudioTrackAudit.js";
import Logger from 'log4js';
import { AudioTrackStats } from "../Views/AudioTrackStats.js";
import { QueryTypes } from "sequelize";
import { AudioStats } from "../Views/AudioStats.js";

const logger = Logger.getLogger('db_audio');

class AudioStatsContext {
    public async SaveUserPlay(track: Media, userId: string, guildId: string): Promise<AudioTrack> {
        let audio = await AudioTrack.findOne({
            where: {
                serviceType: track.ServiceMeta.name,
                serviceId: track.ServiceMeta.id,
            },
        });
        if (!audio) {
            audio = await AudioTrack.create({
                serviceType: track.ServiceMeta.name,
                serviceId: track.ServiceMeta.id,
                title: track.Title,
                duration: track.Duration,
            });
        }

        await AudioTrackAudit.create({
            trackId: audio.id,
            userId: userId,
            guildId: guildId,
        });

        return audio;
    }

    public async GetLastUserPlay(userId: string): Promise<AudioTrack | undefined> {
        const audio = await AudioTrackAudit.findOne({
            include: [AudioTrackAudit.associations.track],
            where: {
                userId: userId,
            },
            order: [['created_at', 'DESC']]
        });

        return audio?.track;
    }

    public async SetWebTrackMeta(track: WebTrack, meta: AudioMetaInfo) {
        const audio = await AudioTrack.findOne({
            where: {
                serviceType: TRACK_TYPE_ENUM.direct,
                serviceId: track.Url.toString(),
            },
        });
        if (!audio) {
            logger.warn('Tried to update track that does not exist!');
            return;
        }

        audio.set({
            title: [meta.Artist, meta.Title].filter(Boolean).join(' - '),
            duration: meta.Duration,
        });
        await audio.save();
    }

    public async GetTopTracks(count: number): Promise<AudioTrackStats[]> {
        const audios = await sequelize.query<AudioTrackStats>(`
            select
                track.track_type as serviceName,
                track.service_id as serviceId,
                track.title as title,
                count(audit.id) as count
            from audio_tracks track
            join audio_track_audits audit on track.id = audit.track_id
            group by track.track_type, track.service_id, track.title
            order by count(audit.id) desc
            limit ${count};
            `, {
                type: QueryTypes.SELECT,
            });

        return audios;
    }

    public async GetOverallStats(): Promise<AudioStats> {
        const stats = await sequelize.query<AudioStats>(`
            select
                (select count(*) from audio_track_audits) as total,
                (select count(DISTINCT user_id) from audio_track_audits) as users,
                (select count(DISTINCT track_id) from audio_track_audits) as tracks,
                (select count(DISTINCT guild_id) from audio_track_audits) as servers
            `, {
                type: QueryTypes.SELECT,
            });
        
        return stats[0];
    }
}

export default AudioStatsContext;
