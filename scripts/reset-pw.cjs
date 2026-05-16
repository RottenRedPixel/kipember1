const { Client } = require('pg');
const { scryptSync, randomBytes } = require('crypto');

const salt = randomBytes(16).toString('hex');
const derived = scryptSync('Ember123!', salt, 64).toString('hex');
const hash = salt + ':' + derived;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => client.query(
    'UPDATE "User" SET "passwordHash" = $1 WHERE "phoneNumber" = $2 RETURNING id, email',
    [hash, '+18484684648']
  ))
  .then((res) => {
    if (res.rowCount === 0) {
      console.error('No user found with that phone number.');
    } else {
      console.log('Done. Password set for:', res.rows[0].email);
      console.log('Temp password: Ember123!');
    }
    return client.end();
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
