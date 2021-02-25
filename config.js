/** Common config for chess tournament organizer. */

const SECRET_KEY = process.env.SECRET_KEY || 'greek-gift';
const BCRYPT_WORK_FACTOR = 13;
const PORT = process.env.PORT || 3001;
const API_URL = 'https://lichess.org';

let DB_URI = `postgresql://`;

if (process.env.NODE_ENV === 'test') {
    DB_URI = `${DB_URI}/chess-tournament-organizer-test`;
} else {
    DB_URI = process.env.DATABASE_URL || `${DB_URI}/chess-tournament-organizer`;
}


module.exports = { DB_URI, SECRET_KEY, BCRYPT_WORK_FACTOR, PORT, API_URL };