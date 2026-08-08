import { DataTypes, Model } from 'sequelize';

/**
 * A Kerghan account. Login identity is a username/password pair, independent
 * of any GitHub handle (tracked separately, see docs/agents/product.md).
 * @author darthjee
 */
class User extends Model {
  /**
   * Initializes the model against a Sequelize connection.
   * @param {object} sequelize - The Sequelize connection instance.
   * @returns {typeof User} This class, for chaining.
   */
  static init(sequelize) {
    return super.init({
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      passwordDigest: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'password_digest',
      },
    }, {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true,
    });
  }
}

export { User };
