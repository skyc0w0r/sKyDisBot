import {  Model,  InferAttributes, InferCreationAttributes  } from 'sequelize';

export interface UsersGif extends Model<InferAttributes<UsersGif>, InferCreationAttributes<UsersGif>> {
  discordId: string;
  gif:string;
}
