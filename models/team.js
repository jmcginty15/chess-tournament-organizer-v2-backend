const db = require('../db');

class Team {
    static async getById(id) {
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
}

module.exports = Team;