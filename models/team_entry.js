const db = require('../db');

const ExpressError = require('../expressError');

// Entry in a team tournament
class TeamEntry {
    static async getById(id) {
        /** Gets a single entry by id */
        const res = await db.query(`SELECT
                id,
                player,
                team,
                rating
            FROM team_entries
            WHERE id = $1`, [id]);
        const entry = res.rows[0];

        if (entry) return entry;
        throw new ExpressError(`Entry id ${id} not found`, 404);
    }
}

module.exports = TeamEntry;