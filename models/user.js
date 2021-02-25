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

        if (user) return user;

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

        return user;
    }

    static async update(username, userInfo) {
        if (userInfo.password) userInfo.password = await bcrypt.hash(userInfo.password, BCRYPT_WORK_FACTOR);

        const keys = Object.keys(userInfo);
        const values = Object.values(userInfo);

        let query = `UPDATE users SET`;
        let i = 0;
        for (i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (key === 'firstName') key = 'first_name';
            if (key === 'lastName') key = 'last_name';
            const comma = i === 0 ? '' : ',';

            query += `${comma} ${key} = $${i + 1}`;
        }
        query += ` WHERE username = $${i + 1}
            RETURNING
                username,
                email,
                first_name AS "firstName",
                last_name AS "lastName"`;

        const res = await db.query(query, [...values, username]);
        const user = res.rows[0];

        if (user) return user;

        throw new ExpressError(`User ${username} not found`, 404);
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

        if (user) {
            const valid = await bcrypt.compare(password, user.password);
            if (valid) {
                delete user.password;
                return user;
            }
        }

        throw new ExpressError('Invalid username or password', 401);
    }

    static async getTournaments(username) {
        const indResult = await db.query(`SELECT
                ind_tournaments.id,
                ind_tournaments.name,
                ind_tournaments.director,
                ind_tournaments.time_control AS "timeControl",
                ind_tournaments.category,
                ind_tournaments.min_players AS "minPlayers",
                ind_tournaments.max_players AS "maxPlayers",
                ind_tournaments.rounds,
                ind_tournaments.round_length AS "roundLength",
                ind_tournaments.current_round AS "currentRound",
                ind_tournaments.registration_open AS "registrationOpen",
                ind_tournaments.registration_close AS "registrationClose",
                ind_tournaments.start_date AS "startDate",
                ind_tournaments.started,
                ind_tournaments.ended
            FROM ind_tournaments
            FULL JOIN ind_entries ON ind_entries.tournament = ind_tournaments.id
            WHERE ind_entries.player = $1
            ORDER BY ind_tournaments.start_date DESC`, [username]);
        const indTournaments = indResult.rows;

        const teamResult = await db.query(`SELECT
                team_tournaments.id,
                team_tournaments.name,
                team_tournaments.director,
                team_tournaments.time_control AS "timeControl",
                team_tournaments.category,
                team_tournaments.min_players AS "minPlayers",
                team_tournaments.max_players AS "maxPlayers",
                team_tournaments.team_size AS "teamSize",
                team_tournaments.rounds,
                team_tournaments.round_length AS "roundLength",
                team_tournaments.current_round AS "currentRound",
                team_tournaments.registration_open AS "registrationOpen",
                team_tournaments.registration_close AS "registrationClose",
                team_tournaments.start_date AS "startDate",
                team_tournaments.started,
                team_tournaments.ended
            FROM team_tournaments
            FULL JOIN teams ON teams.tournament = team_tournaments.id
            FULL JOIN team_entries ON team_entries.team = teams.id
            WHERE team_entries.player = $1
            ORDER BY team_tournaments.start_date DESC`, [username]);
        const teamTournaments = teamResult.rows;

        return { ind: indTournaments, team: teamTournaments };
    }

    static async getOngoingTournaments(username) {
        const indResult = await db.query(`SELECT
                ind_tournaments.id,
                ind_tournaments.name,
                ind_tournaments.director,
                ind_tournaments.time_control AS "timeControl",
                ind_tournaments.category,
                ind_tournaments.min_players AS "minPlayers",
                ind_tournaments.max_players AS "maxPlayers",
                ind_tournaments.rounds,
                ind_tournaments.round_length AS "roundLength",
                ind_tournaments.current_round AS "currentRound",
                ind_tournaments.registration_open AS "registrationOpen",
                ind_tournaments.registration_close AS "registrationClose",
                ind_tournaments.start_date AS "startDate",
                ind_tournaments.started,
                ind_tournaments.ended
            FROM ind_tournaments
            FULL JOIN ind_entries ON ind_entries.tournament = ind_tournaments.id
            WHERE ind_entries.player = $1 AND ind_tournaments.started = $2 AND ind_tournaments.ended = $3
            ORDER BY ind_tournaments.start_date DESC`, [username, 1, 0]);
        const indTournaments = indResult.rows;

        const teamResult = await db.query(`SELECT
                team_tournaments.id,
                team_tournaments.name,
                team_tournaments.director,
                team_tournaments.time_control AS "timeControl",
                team_tournaments.category,
                team_tournaments.min_players AS "minPlayers",
                team_tournaments.max_players AS "maxPlayers",
                team_tournaments.team_size AS "teamSize",
                team_tournaments.rounds,
                team_tournaments.round_length AS "roundLength",
                team_tournaments.current_round AS "currentRound",
                team_tournaments.registration_open AS "registrationOpen",
                team_tournaments.registration_close AS "registrationClose",
                team_tournaments.start_date AS "startDate",
                team_tournaments.started,
                team_tournaments.ended
            FROM team_tournaments
            FULL JOIN teams ON teams.tournament = team_tournaments.id
            FULL JOIN team_entries ON team_entries.team = teams.id
            WHERE team_entries.player = $1 AND team_tournaments.started = $2 AND team_tournaments.ended = $3
            ORDER BY team_tournaments.start_date DESC`, [username, 1, 0]);
        const teamTournaments = teamResult.rows;

        return { ind: indTournaments, team: teamTournaments };
    }

    static async getDirectedTournaments(username) {
        const indResult = await db.query(`SELECT
                id,
                name,
                director,
                time_control AS "timeControl",
                category,
                min_players AS "minPlayers",
                max_players AS "maxPlayers",
                rounds,
                round_length AS "roundLength",
                current_round AS "currentRound",
                registration_open AS "registrationOpen",
                registration_close AS "registrationClose",
                start_date AS "startDate",
                started,
                ended
            FROM ind_tournaments
            WHERE director = $1
            ORDER BY start_date DESC`, [username]);
        const indTournaments = indResult.rows;

        const teamResult = await db.query(`SELECT
                id,
                name,
                director,
                time_control AS "timeControl",
                category,
                min_players AS "minPlayers",
                max_players AS "maxPlayers",
                team_size AS "teamSize",
                rounds,
                round_length AS "roundLength",
                current_round AS "currentRound",
                registration_open AS "registrationOpen",
                registration_close AS "registrationClose",
                start_date AS "startDate",
                started,
                ended
            FROM team_tournaments
            WHERE director = $1
            ORDER BY start_date DESC`, [username]);
        const teamTournaments = teamResult.rows;

        return { ind: indTournaments, team: teamTournaments };
    }
}

module.exports = User;