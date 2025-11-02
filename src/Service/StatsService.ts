import { BaseService } from "../Interface/ServiceManagerInterface.js";
import Logger from 'log4js';
import { GlobalServiceManager } from "./ServiceManager.js";
import CommandParserService from "./CommandParserService.js";
import { BaseCommand } from "../Model/CommandParser/index.js";
import DataBaseService from "./DataBaseService.js";
import { EmbedBuilder } from "discord.js";
import { TRACK_TYPE_ENUM } from "../Enums/TrackType.js";

class StatsService extends BaseService {
    private logger: Logger.Logger;
    private db: DataBaseService;

    constructor() {
        super();
        this.logger = Logger.getLogger('audio_manager');
    }

    async Init(): Promise<void> {
        let cp = GlobalServiceManager().GetRequiredService(CommandParserService);
        this.db = GlobalServiceManager().GetRequiredService(DataBaseService);

        cp = cp.RegisterCategory('stats', undefined, 'Bot statistics');

        cp.RegisterCommand('audio', this.DisplayGlobalAudioStats.bind(this), {
            description: 'Display audio play statistics'
        });
    }
    async Destroy(): Promise<void> {
    }

    private async DisplayGlobalAudioStats(cmd: BaseCommand): Promise<void> {
        const tracks = await this.db.AudioStats.GetTopTracks(10);
        const stats = await this.db.AudioStats.GetOverallStats();

        const eb = new EmbedBuilder()
            .setTitle('Global audio top')
            .setDescription(`Played **${stats.tracks}** songs **${stats.total}** times over **${stats.servers}** servers by **${stats.users}** people`)
            .setFooter({
                text: 'Top songs played over all server by all users'
            })
            .setColor('#D02010');

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];

            let linkBase = '';
            if (track.serviceName === TRACK_TYPE_ENUM.youtube) {
                linkBase = 'https://youtu.be/';
            } else if (track.serviceName === TRACK_TYPE_ENUM.yandex) {
                linkBase = 'https://music.yandex.ru/track/'
            }
            linkBase += track.serviceId;

            eb.addFields({
                name: `#${i + 1} - ${track.count} plays`,
                value: `[🌍](${linkBase}) ${track.title}`
            });
        }
        cmd.reply({ embeds: [eb] })
    }
}

export default StatsService;