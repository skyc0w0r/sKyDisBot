import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { GlobalServiceManager } from './ServiceManager.js';
import CommandParserService from './CommandParserService.js';
import { Sequelize, DataTypes  } from 'sequelize';
import Logger from 'log4js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import { UsersGif } from '../Interface/DatabaseServiceIntreface';
import {PermissionsBitField} from 'discord.js';
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
              id: 'discordId',
              description: 'Nickname user',
              required: true,
            },
            {
              id: 'gif',
              description: 'Link for GIF',
              required: true,
          },
        ],

    });
    cp.RegisterCommand('gif_change', (c) => this.gifChange(c), {
      description: 'Change gif for user',
      options: [
          {
            id: 'discordId',
            description: 'Nickname user',
            required: true,
          },
          {
            id: 'gif',
            description: 'Link for GIF',
            required: true,
        },
      ],

    });
    cp.RegisterCommand('gif_remove', (c) => this.gifRemove(c), {
      description: 'Remove gif for user',
      options: [
        {
          id: 'discordId',
          description: 'Nickname user',
          required: true,
        },
      ],
    });
    }
    // Add new Record to DB
    private async gifAdd(cmd: BaseCommand): Promise<void> {
      if(cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)){
        if (!(await this.checkUserInDB(cmd.Params['discordId'].value, cmd.Guild.id))) {
          await UsersGif.create({
            discordId: cmd.Params['discordId'].value,
            gif: cmd.Params['gif'].value,
            guildId: cmd.Guild.id
          });
          await cmd.reply({content: 'User added successfully '});
        } else {
          await cmd.reply({content: 'User exist in DB '});
        }
      } else {
        await cmd.reply({content: 'Command only for moderators'});
      }
    }

    // change gif for user
    private async gifChange(cmd: BaseCommand): Promise<void> {
      if(cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)){
        if (await this.checkUserInDB(cmd.Params['discordId'].value, cmd.Guild.id)) {
          await UsersGif.update({ gif: cmd.Params['gif'].value}, {where: {
            discordId: cmd.Params['discordId'].value,
            guildId: cmd.Guild.id
          }
          });
          await cmd.reply({content: 'User updated successfully '});

        } else {
          await cmd.reply({content: 'The user is not in the database. Please add a user via the command "gif {user} {link gif}"'});
        }
      } else {
        await cmd.reply({content: 'Command only for moderators'});
      }
    }

      // Remove gif for user
      private async gifRemove(cmd: BaseCommand): Promise<void> {
        if(cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)){
          if (await this.checkUserInDB(cmd.Params['discordId'].value, cmd.Guild.id)) {
            await UsersGif.destroy({where: {
              discordId: cmd.Params['discordId'].value
            }
            });
            await cmd.reply({content: 'User deleted successfully '});
          } else {
            await cmd.reply({content: 'The user is not in the database.'});
          }
        } else {
          await cmd.reply({content: 'Command only for moderators'});
        }
      }

    public async checkUserInDB(idUser: string, idGuild: string): Promise<boolean> {
      return await UsersGif.findOne({
        where: {
          discordId: idUser,
          guildId: idGuild
        }
      }) ? true : false;
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
    type: DataTypes.STRING,
  },
  gif: DataTypes.TEXT,
  guildId: {
    type: DataTypes.TEXT,
    unique: true,
  }
});

export { UsersGif };
export default DataBaseService;
