import { InferAttributes, InferCreationAttributes, Model } from 'sequelize';

export interface UsersGif extends Model<InferAttributes<UsersGif>, InferCreationAttributes<UsersGif>> {
  discordId: string;
  gif:string;
  guildId: string;
  lastSent?: Date;
}
