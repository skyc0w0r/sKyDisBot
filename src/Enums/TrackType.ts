export const TRACK_TYPE_ENUM: Record<TrackType, TrackType> = {
    youtube: 'youtube',
    yandex: 'yandex',
    direct: 'direct',
}

export type TrackType = 'youtube' | 'yandex' | 'direct'
