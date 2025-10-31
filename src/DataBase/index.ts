import { Sequelize } from 'sequelize';
import config from '../config.js';

const sequelize = new Sequelize(config.get().DB_URL);

export { Sequelize, sequelize };
