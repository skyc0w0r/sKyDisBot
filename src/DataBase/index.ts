import { Sequelize } from 'sequelize';
import config from '../config.js';
import Logger from 'log4js';

const logger = Logger.getLogger('sql');

const sequelize = new Sequelize(config.get().DB_URL, {
    logging: (m) => logger.trace(m),
});

export { Sequelize, sequelize };
