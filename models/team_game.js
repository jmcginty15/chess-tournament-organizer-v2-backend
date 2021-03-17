const db = require('../db');
const axios = require('axios');
const { API_URL } = require('../config');
const { updateIndRating } = require('../helpers/entries');
const { averageRating } = require('../helpers/tournaments');

// Game in a team tournament
class TeamGame {
    static async schedule(id, schedule) {
        /** Schedules a game */
        const gameRes = await db.query(`UPDATE team_games
            SET schedule = $1
            WHERE id = $2
            RETURNING
                id,
                white,
                black,
                match,
                result,
                schedule`,
            [schedule, id]);
        const game = gameRes.rows[0];

        const matchRes = await db.query(`SELECT tournament
            FROM team_matches
            WHERE id = $1`, [game.match]);
        const match = matchRes.rows[0];

        if (game) {
            game.tournament = match.tournament;
            return game;
        }
        throw new ExpressError(`Game id ${id} not found`, 404);
    }

    static async getParticipants(id) {
        /** Returns the participants in a game */
        const gameRes = await db.query(`SELECT white, black
            FROM team_games
            WHERE id = $1`, [id]);
        const game = gameRes.rows[0];

        const whiteRes = await db.query(`SELECT player
            FROM team_entries
            WHERE id = $1`, [game.white]);
        const white = whiteRes.rows[0];

        const blackRes = await db.query(`SELECT player
            FROM team_entries
            WHERE id = $1`, [game.black]);
        const black = blackRes.rows[0];

        return { white: white, black: black };
    }

    static async report(id, lichessId) {
        /** Gets the results of a game from the Lichess API */
        const lichessRes = await axios.get(`${API_URL}/game/export/${lichessId}`);
        const gameData = lichessRes.data;

        const resultIndex = gameData.indexOf('Result');
        let result = gameData.slice(resultIndex + 8, gameData.indexOf('"', resultIndex + 8));
        if (result === '1/2-1/2') result = '0.5-0.5';

        const gameRes = await db.query(`UPDATE team_games
            SET result = $1, url = $2
            WHERE id = $3
            RETURNING
                id,
                white,
                black,
                match,
                result,
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

        const matchRes = await db.query(`SELECT id, team_1 AS "team1", team_2 AS "team2", tournament, result
            FROM team_matches
            WHERE id = $1`, [game.match]);
        const match = matchRes.rows[0];
        game.tournament = match.tournament;

        const whiteRes = await db.query(`SELECT id, team
            FROM team_entries
            WHERE id = $1`, [game.white]);
        const white = whiteRes.rows[0];

        const blackRes = await db.query(`SELECT id, team
            FROM team_entries
            WHERE id = $1`, [game.black]);
        const black = blackRes.rows[0];

        let team1Score = 0;
        let team2Score = 0;
        if (white.team === match.team1) {
            team1Score = whiteScore;
            team2Score = blackScore;
        } else if (black.team === match.team1) {
            team1Score = blackScore;
            team2Score = whiteScore;
        }

        const matchResult = match.result ? match.result : '0-0';
        let [team1MatchScore, team2MatchScore] = matchResult.split('-');
        team1MatchScore = parseFloat(team1MatchScore) + team1Score;
        team2MatchScore = parseFloat(team2MatchScore) + team2Score;

        await db.query(`UPDATE team_matches
            SET result = $1
            WHERE id = $2`, [`${team1MatchScore}-${team2MatchScore}`, match.id]);

        const team1Res = await db.query(`SELECT score
            FROM teams
            WHERE id = $1`, [match.team1]);
        const team1CurrentScore = team1Res.rows[0].score;
        team1Score += team1CurrentScore;
        if (team1Score) {
            await db.query(`UPDATE teams
                SET score = $1
                WHERE id = $2`, [team1Score, match.team1]);
        }

        const team2Res = await db.query(`SELECT score
            FROM teams
            WHERE id = $1`, [match.team2]);
        const team2CurrentScore = team2Res.rows[0].score;
        team2Score += team2CurrentScore;
        if (team2Score) {
            await db.query(`UPDATE teams
                SET score = $1
                WHERE id = $2`, [team2Score, match.team2]);
        }

        const tournRes = await db.query(`SELECT category FROM team_tournaments WHERE id = $1`, [game.tournament]);
        const tournCategory = tournRes.rows[0].category;
        const entryResWhite = await db.query(`SELECT player FROM team_entries WHERE id = $1`, [game.white]);
        const whiteEntry = entryResWhite.rows[0];
        const entryResBlack = await db.query(`SELECT player FROM team_entries WHERE id = $1`, [game.black]);
        const blackEntry = entryResBlack.rows[0];

        const whiteRating = await updateIndRating(whiteEntry, tournCategory);
        const blackRating = await updateIndRating(blackEntry, tournCategory);

        await db.query(`UPDATE team_entries SET rating = $1 WHERE id = $2`, [whiteRating.rating, game.white]);
        await db.query(`UPDATE team_entries SET rating = $1 WHERE id = $2`, [blackRating.rating, game.black]);

        const team1EntryRes = await db.query(`SELECT rating FROM team_entries WHERE team = $1`, [match.team1]);
        const team1Players = team1EntryRes.rows;
        await db.query(`UPDATE teams SET rating = $1 WHERE id = $2`, [averageRating(team1Players), match.team1]);

        const team2EntryRes = await db.query(`SELECT rating FROM team_entries WHERE team = $1`, [match.team2]);
        const team2Players = team2EntryRes.rows;
        await db.query(`UPDATE teams SET rating = $1 WHERE id = $2`, [averageRating(team2Players), match.team2]);

        return game;
    }
}

module.exports = TeamGame;