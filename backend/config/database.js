/**
 * Sequelize CLI connection config, read once at boot from env vars — no
 * hidden env reads elsewhere (see docs/agents/architecture/backend.md).
 * Consumed by `yarn sequelize-cli db:migrate` (make setup) and by
 * models/index.js once real models exist.
 */
const base = {
  username: process.env.KERGHAN_MYSQL_USER,
  password: process.env.KERGHAN_MYSQL_PASSWORD,
  database: process.env.KERGHAN_MYSQL_NAME,
  host: process.env.KERGHAN_MYSQL_HOST,
  port: process.env.KERGHAN_MYSQL_PORT,
  dialect: 'mysql',
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
