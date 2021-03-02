const db = require('../db');
const ExpressError = require('../expressError');

// Team
class Team {
    static async getById(id) {
        /** Gets a single team by id */
        const teamRes = await db.query(`SELECT
                id,
                name,
                tournament,
                rating,
                seed,
                score,
                sonneborn_berger_score AS "sonnebornBergerScore",
                place,
                prev_opponents AS "prevOpponents",
                prev_colors AS "prevColors"
            FROM teams
            WHERE id = $1`, [id]);
        const team = teamRes.rows[0];

        const entryRes = await db.query(`SELECT id, player, rating
            FROM team_entries
            WHERE team = $1
            ORDER BY rating DESC`, [id]);
        team.members = entryRes.rows;

        return team;
    }

    static async rename(id, newName) {
        /** Updates a team's name */
        const teamRes = await db.query(`UPDATE teams
            SET name = $1
            WHERE id = $2
            RETURNING
                id,
                name,
                tournament,
                rating,
                seed,
                score,
                sonneborn_berger_score AS "sonnebornBergerScore",
                place,
                prev_opponents AS "prevOpponents",
                prev_colors AS "prevColors"`,
            [newName, id]);
        const team = teamRes.rows[0];

        if (team) return team;
        throw new ExpressError(`Team id ${id} not found`, 404);
    }
}

module.exports = Team;