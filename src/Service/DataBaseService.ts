import Logger from 'log4js';
import { BaseService } from "../Interface/ServiceManagerInterface.js";
import { sequelize } from "../DataBase/index.js";
import GifContext from '../DataBase/Context/GifContext.js';
import AudioStatsContext from '../DataBase/Context/AudioStatsContext.js';
import PreferenceContext from '../DataBase/Context/PreferenceContext.js';

const logger = Logger.getLogger('db');

class DataBaseService extends BaseService {
    public get Gif() {
        return this.gif;
    }
    private gif: GifContext;

    public get AudioStats() {
        return this.audioStats;
    }
    private audioStats: AudioStatsContext;

    public get ServerPreference() {
        return this.serverPreference;
    }
    private serverPreference: PreferenceContext;

    public async Init(): Promise<void> {
        await sequelize.authenticate();
        await sequelize.sync();
        logger.info('Connected to database');

        this.gif = new GifContext();
        this.audioStats = new AudioStatsContext();
        this.serverPreference = new PreferenceContext();
    }

    public async Destroy(): Promise<void> {
        await sequelize.close();
    }
}

export default DataBaseService;
