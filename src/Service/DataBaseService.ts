import { PermissionsBitField } from 'discord.js';
import Logger from 'log4js';
import { DataTypes, Sequelize } from 'sequelize';
import { UsersGif } from '../Interface/DatabaseServiceIntreface';
import { BaseService } from '../Interface/ServiceManagerInterface.js';
import { BaseCommand } from '../Model/CommandParser/index.js';
import CommandParserService from './CommandParserService.js';
import { GlobalServiceManager } from './ServiceManager.js';

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
    cp.RegisterCommand('gif_list', (c) => this.gifList(c), {
      description: 'List all gifs',
    });
    }
    // Add new Record to DB
    private async gifAdd(cmd: BaseCommand): Promise<void> {
      if(!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)){
        await cmd.reply({content: 'Command only for moderators'});
        return;
      }

      const discordId =
        /^<@\d+>$/.test(cmd.Params['discordId'].value) &&
        cmd.Params['discordId'].value;

      if (!discordId) {
        await cmd.reply({content: 'Invalid discord id'});
        return;
      }

      const user = await UsersGif.findOne({
        where: {
          discordId: discordId,
          guildId: cmd.Guild.id
        }
      });

      if (user){
        await cmd.reply({content: 'User exist in DB '});
        return;
      }

      await UsersGif.create({
        discordId: discordId,
        gif: cmd.Params['gif'].value,
        guildId: cmd.Guild.id
      });
      await cmd.reply({content: 'User added successfully '});
    }

    // change gif for user
    private async gifChange(cmd: BaseCommand): Promise<void> {
      if(!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)){
        await cmd.reply({content: 'Command only for moderators'});
        return;
      }

      const discordId =
      /^<@\d+>$/.test(cmd.Params['discordId'].value) &&
      cmd.Params['discordId'].value;

      if (!discordId) {
        await cmd.reply({content: 'Invalid discord id'});
        return;
      }

      const user = await UsersGif.findOne({
        where: {
          discordId: discordId,
          guildId: cmd.Guild.id
        }
      });

      if (!user) {
        await cmd.reply({
          content: `The user is not in the database.
                    Please add a user via the command "gif {user} {link gif}"`
        });
        return;
      }

      await user.update({'gif': cmd.Params['gif'].value});
      await cmd.reply({content: 'User updated successfully '});
    }

    // Remove gif for user
    private async gifRemove(cmd: BaseCommand): Promise<void> {
      if(!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)){
        await cmd.reply({content: 'Command only for moderators'});
        return;
      }

      const discordId =
      /^<@\d+>$/.test(cmd.Params['discordId'].value) &&
      cmd.Params['discordId'].value;

      if (!discordId) {
        await cmd.reply({content: 'Invalid discord id'});
        return;
      }

      const user = await UsersGif.findOne({
        where: {
          discordId: discordId,
          guildId: cmd.Guild.id
        }
      });

      if (!user){
        await cmd.reply({content: 'The user is not in the database.'});
        return;
      }

      await user.destroy();
      await cmd.reply({content: 'User deleted successfully '});
    }

    private async gifList(cmd: BaseCommand): Promise<void> {
      if(!cmd.User.permissions.has(PermissionsBitField.Flags.ManageGuild)){
        await cmd.reply({content: 'Command only for moderators'});
        return;
      }

      const userList = await UsersGif.findAll({
        where: {
          guildId: cmd.Guild.id
        }
      });

      await cmd.reply({
          embeds: [
          {
            title: `List gifs for ${cmd.Guild.name}`,
            color: Math.floor(Math.random() * 16777215),
            fields: userList.reduce((acc, u) => {
              return [...acc, {
                name: 'User',
                value: u.discordId,
                inline: true,
              },
              {
                name: 'Gif',
                value: u.gif,
                inline: true,
              },
              {
                name: 'Last sent',
                value: u?.lastSent ? u.lastSent.toISOString() : '-',
                inline: true,
              },
              {
                name: '\u200b',
                value: '\u200b',
                inline: false,
              },];
            }, [])
          },
        ],
      });
    }

    // Close connection
    public async Destroy(): Promise<void> {
      await sequelize.close();
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
  discordId: DataTypes.STRING,
  gif: DataTypes.TEXT,
  guildId: DataTypes.TEXT,
  lastSent: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export { UsersGif };
export default DataBaseService;
