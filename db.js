/** Database config for database. */


const { Client } = require('pg');
const { DB_URI } = require('./config');

console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
console.log(DB_URI);

let db = new Client({
    connectionString: DB_URI
});

db.connect();


module.exports = db;
