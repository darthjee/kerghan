import { Sequelize } from 'sequelize';
import config from '../config/database.js';
import { User } from './User.js';

const env = process.env.NODE_ENV ?? 'development';
const sequelize = new Sequelize(config[env]);

User.init(sequelize);

export { sequelize, User };
