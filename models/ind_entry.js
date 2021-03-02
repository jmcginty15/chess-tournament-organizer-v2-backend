const db = require('../db');

const ExpressError = require('../expressError');

// Entry in an individual tournament
class IndEntry {
    static async getById(id) {
        /** Gets a single entry by id */
        const res = await db.query(`SELECT
                id,
                player,
                tournament,
                seed,
                rating,
                score,
                sonneborn_berger_score AS "sonnebornBergerScore",
                place,
                prev_opponents AS "prevOpponents",
                prev_colors AS "prevColors"
            FROM ind_entries
            WHERE id = $1`, [id]);
        const entry = res.rows[0];

        if (entry) return entry;
        throw new ExpressError(`Entry id ${id} not found`, 404);
    }
}

module.exports = IndEntry;