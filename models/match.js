const db = require('../db');
const ExpressError = require('../expressError');

// Match in a team tournament
class Match {
    static async getById(id) {
        /** Gets a match by id */
        const res = await db.query(`SELECT * FROM team_matches`);
        const match = res.rows[0];

        if (match) return match;
        throw new ExpressError(`Match id ${id} not found`, 404);
    }
}

module.exports = Match;