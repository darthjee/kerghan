'use strict';

const bcrypt = require('bcryptjs');

// Dev/manual-testing convenience only — seeders never run against production
// deploys. Login with username "demo" / password "kerghan-demo" once seeded.
const USERNAME = 'demo';
const EMAIL = 'demo@kerghan.test';
const PASSWORD = 'kerghan-demo';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface) => {
    const passwordDigest = await bcrypt.hash(PASSWORD, 10);
    const now = new Date();

    await queryInterface.bulkInsert('users', [{
      username: USERNAME,
      email: EMAIL,
      password_digest: passwordDigest,
      created_at: now,
      updated_at: now,
    }]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', { username: USERNAME });
  },
};
