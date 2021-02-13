const db = require('../db');
const bcrypt = require('bcrypt');
const ExpressError = require('../expressError');
const { BCRYPT_WORK_FACTOR } = require('../config');

class User {
    static async getByUsername(username) {
        const res = await db.query(`SELECT
            username,
            email,
            first_name AS "firstName",
            last_name AS "lastName"
        FROM users WHERE username = $1`, [username]);
        const user = res.rows[0];

        if (user) {
            user.firstName = user.first_name;
            delete user.first_name;
            user.lastName = user.last_name;
            delete user.last_name;
            return user;
        }

        throw new ExpressError(`User ${username} not found`, 404);
    }

    static async register({ username, email, password, firstName, lastName }) {
        const dupUsernameCheck = await db.query(`SELECT username FROM users WHERE username = $1`, [username]);
        if (dupUsernameCheck.rows.length) throw new ExpressError('Duplicate username', 400);
        const dupEmailCheck = await db.query(`SELECT username FROM users WHERE email = $1`, [email]);
        if (dupEmailCheck.rows.length) throw new ExpressError('Duplicate email', 400);

        const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);
        const userResult = await db.query(`INSERT INTO users (username, email, password, first_name, last_name)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
                username,
                email,
                first_name AS "firstName",
                last_name AS "lastName"`,
            [username, email, hashedPassword, firstName, lastName]);
        const user = userResult.rows[0];
        user.firstName = user.first_name;
        delete user.first_name;
        user.lastName = user.last_name;
        delete user.last_name;
        return user;
    }

    static async login(username, password) {
        const result = await db.query(`SELECT
                username,
                email,
                password,
                first_name AS "firstName",
                last_name AS "lastName"
            FROM users WHERE username = $1`, [username]);
        const user = result.rows[0];
        user.firstName = user.first_name;
        delete user.first_name;
        user.lastName = user.last_name;
        delete user.last_name;

        if (user) {
            const valid = await bcrypt.compare(password, user.password);
            if (valid) {
                delete user.password;
                return user;
            }
        }

        throw new ExpressError('Invalid username or password', 401);
    }
}

module.exports = User;