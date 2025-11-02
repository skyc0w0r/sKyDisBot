import { TrackType } from "../../Enums/TrackType.js";

export interface AudioTrackStats {
    serviceName: TrackType;
    serviceId: string;
    title: string;
    count: number;
}
