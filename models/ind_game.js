const db = require('../db');
const axios = require('axios');
const { API_URL } = require('../config');

const ExpressError = require('../expressError');

class IndGame {
    static async schedule(id, schedule) {
        const res = await db.query(`UPDATE ind_games
            SET schedule = $1
            WHERE id = $2
            RETURNING
                id,
                round,
                white,
                black,
                tournament,
                result,
                schedule`,
            [schedule, id]);
        const game = res.rows[0];

        if (game) return game;
        throw new ExpressError(`Game id ${id} not found`, 404);
    }

    static async getParticipants(id) {
        const gameRes = await db.query(`SELECT white, black
            FROM ind_games
            WHERE id = $1`, [id]);
        const game = gameRes.rows[0];

        const whiteRes = await db.query(`SELECT player
            FROM ind_entries
            WHERE id = $1`, [game.white]);
        const white = whiteRes.rows[0];

        const blackRes = await db.query(`SELECT player
            FROM ind_entries
            WHERE id = $1`, [game.black]);
        const black = blackRes.rows[0];

        return { white: white, black: black };
    }

    static async report(id, lichessId) {
        const lichessRes = await axios.get(`${API_URL}/game/export/${lichessId}`);
        const gameData = lichessRes.data;

        const resultIndex = gameData.indexOf('Result');
        let result = gameData.slice(resultIndex + 8, gameData.indexOf('"', resultIndex + 8));
        if (result === '1/2-1/2') result = '0.5-0.5';

        const gameRes = await db.query(`UPDATE ind_games
            SET result = $1, url = $2
            WHERE id = $3
            RETURNING
                id,
                round,
                white,
                black,
                tournament,
                url,
                schedule`,
            [result, `${API_URL}/${lichessId}`, id]);
        const game = gameRes.rows[0];

        let whiteScore = 0;
        let blackScore = 0;
        if (result === '1-0') whiteScore = 1;
        if (result === '0-1') blackScore = 1;
        if (result === '0.5-0.5') {
            whiteScore = 0.5;
            blackScore = 0.5;
        }

        if (whiteScore) {
            const whiteRes = await db.query(`SELECT score
                FROM ind_entries
                WHERE id = $1`, [game.white]);
            const currentScore = whiteRes.rows[0].score;
            await db.query(`UPDATE ind_entries
                SET score = $1
                WHERE id = $2`, [currentScore + whiteScore, game.white]);
        }

        if (blackScore) {
            const blackRes = await db.query(`SELECT score
                FROM ind_entries
                WHERE id = $1`, [game.black]);
            const currentScore = blackRes.rows[0].score;
            await db.query(`UPDATE ind_entries
                SET score = $1
                WHERE id = $2`, [currentScore + blackScore, game.black]);
        }

        return game;
    }
}

module.exports = IndGame;