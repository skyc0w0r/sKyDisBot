import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { GlobalServiceManager } from './ServiceManager.js';
import CommandParserService from './CommandParserService.js';
import { Sequelize, Model, DataTypes  } from 'sequelize';
import Logger from 'log4js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import { UsersGif } from '../Interface/DatabaseServiceIntreface';

class DataBaseService extends BaseService {

    public async Init(): Promise<void> {
      const cp = GlobalServiceManager().GetService(CommandParserService);
      try {
        await sequelize.authenticate();
        UsersGif.sync();
        logger.info('Connection has been established successfully.');
      } catch (error) {
        logger.error('Unable to connect to the database:', error);
      }
      cp.RegisterCommand('gif', (c) => this.gifAdd(c), {
        description: 'Subscribing to a channel join event so that the bot sends a GIF',
        options: [
            {
                id: 'username',
                description: 'Nickname user',
                required: true,
            },
            {
              id: 'gif',
              description: 'Link for GIF',
              required: true,
          },
        ]
    });
    }
    // Add new Record to DB
    private async gifAdd(cmd: BaseCommand): Promise<void> {
      await UsersGif.create({
        discordId: cmd.Params['username'].value,
        gif: cmd.Params['gif'].value
      });
      await cmd.reply({content: 'User added successfully '});
    }

    // Close connection
    public async Destroy(): Promise<void> {
      await sequelize.close();
    }

    // Show all record
    // public async showAllRecords(): Promise<void> {
    //   const users = await UsersGif.findAll();
    //   users.every(user => user instanceof UsersGif);
    //   logger.info('All users:', JSON.stringify(users, null, 2));
    // }

    public async searchById(idUser: string): Promise<Model> {
      return await UsersGif.findOne({ where: {discordId: `@${idUser}`}});
    }
}

const logger = Logger.getLogger('main');

const sequelize = new Sequelize('database', 'user', 'password', {
  host: 'localhost',
  dialect: 'sqlite',
  logging: false,
  storage: 'db.sqlite',
});


const UsersGif = sequelize.define<UsersGif>('users_gif', {
  discordId: {
    type: DataTypes.NUMBER,
    unique: true,
  },
  gif: DataTypes.TEXT,
});

export { UsersGif };
export default DataBaseService;
