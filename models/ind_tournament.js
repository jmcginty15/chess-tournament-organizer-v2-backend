const db = require('../db');
const ExpressError = require('../expressError');
const axios = require('axios');
const { API_URL } = require('../config');
const { batchify, unbatchify, delay, getCategory, getRating, assignInitialPlaces, generatePairings, calculateSonnebornBergerScore } = require('../helpers/tournaments');
const { updateIndRating } = require('../helpers/entries');

class IndTournament {
    static async create({
        director,
        name,
        timeControl,
        minPlayers,
        maxPlayers,
        rounds,
        roundLength,
        registrationOpen,
        registrationClose,
        startDate
    }) {
        const dupNameCheck = await db.query(`SELECT name FROM ind_tournaments WHERE name = $1`, [name]);
        if (dupNameCheck.rows.length) throw new ExpressError('Duplicate name', 400);
        const category = getCategory(timeControl);

        const res = await db.query(`INSERT INTO ind_tournaments
            (director, name, time_control, category, min_players, max_players, rounds, round_length, current_round, registration_open, registration_close, start_date, started, ended)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING
                id,
                director,
                name,
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
                ended`,
            [director, name, timeControl, category, minPlayers, maxPlayers, rounds, roundLength, 0, registrationOpen, registrationClose, startDate, 0, 0]);
        const tournament = res.rows[0];
        return tournament;
    }

    static async delete(id) {
        await db.query(`DELETE FROM ind_tournaments WHERE id = $1`, [id]);
        return 'deleted';
    }

    static async getAll() {
        const res = await db.query(`SELECT
                id,
                director,
                name,
                time_control AS "timeControl",
                category,
                rounds,
                round_length AS "roundLength",
                current_round AS "currentRound",
                registration_open AS "registrationOpen",
                registration_close AS "registrationClose",
                start_date AS "startDate"
            FROM ind_tournaments
            ORDER BY start_date DESC`);
        const tournaments = res.rows;
        return tournaments;
    }

    static async getById(id) {
        const tournRes = await db.query(`SELECT
                id,
                director,
                name,
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
            FROM ind_tournaments WHERE id = $1`, [id]);
        const tournament = tournRes.rows[0];

        const entryRes = await db.query(`SELECT
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
            WHERE tournament = $1
            ORDER BY place`, [id]);
        tournament.entries = entryRes.rows;

        const gameRes = await db.query(`SELECT
                id,
                round,
                white,
                black,
                result,
                url,
                schedule
            FROM ind_games
            WHERE tournament = $1
            ORDER BY schedule, id`, [id]);
        tournament.games = gameRes.rows;

        if (tournament) return tournament;

        throw new ExpressError(`Tournament id ${id} not found`, 404);
    }

    static async enter(id, username) {
        const tournRes = await db.query(`SELECT category FROM ind_tournaments WHERE id = $1`, [id]);
        const tournament = tournRes.rows[0];
        if (!tournament) throw new ExpressError(`Tournament id ${id} not found`, 404);

        const userRes = await db.query(`SELECT username FROM users WHERE username = $1`, [username]);
        const user = userRes.rows[0];
        if (!user) throw new ExpressError(`User ${username} not found`, 404);

        const lichessUserRes = await axios.get(`${API_URL}/api/user/${username}`);
        const ratings = lichessUserRes.data.perfs;

        const rating = getRating(ratings, tournament.category);

        const entryRes = await db.query(`INSERT INTO ind_entries
            (player, tournament, seed, rating, score, sonneborn_berger_score, place, prev_opponents, prev_colors)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING
                player,
                tournament,
                seed,
                rating,
                score,
                sonneborn_berger_score AS "sonnebornBergerScore",
                place,
                prev_opponents AS "prevOpponents",
                prev_colors AS "prevColors"`,
            [username, id, 0, rating, 0, 0, 0, '', '']);
        const entry = entryRes.rows[0];

        return entry;
    }

    static async updateAllRatings(id) {
        const tournRes = await db.query(`SELECT category FROM ind_tournaments WHERE id = $1`, [id]);
        const { category } = tournRes.rows[0];

        const entryRes = await db.query(`SELECT
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
            WHERE tournament = $1`, [id]);

        const entryBatches = batchify(entryRes.rows, 15);

        let i = 0;
        for (let batch of entryBatches) {
            const promises = batch.map(entry => updateIndRating(entry, category));
            await Promise.all(promises).then(async batch => {
                for (let entry of batch) {
                    await db.query(`UPDATE ind_entries SET rating = $1
                        WHERE player = $2 AND tournament = $3`,
                        [entry.rating, entry.player, entry.tournament]);
                }
            });
            i++;
            if (i < entryBatches.length) delay(4000);
        }

        const entries = unbatchify(entryBatches);

        return entries;
    }

    static async assignSeeds(id) {
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
            WHERE tournament = $1
            ORDER BY rating DESC`, [id]);
        const entries = res.rows;
        const orderedEntries = assignInitialPlaces(entries);

        for (let i = 0; i < orderedEntries.length; i++) {
            const nextRes = await db.query(`UPDATE ind_entries
                SET seed = $1, place = $1
                WHERE player = $2 AND tournament = $3
                RETURNING seed, place`,
                [i + 1, orderedEntries[i].player, id]);
            orderedEntries[i].seed = nextRes.rows[0].seed;
            orderedEntries[i].place = nextRes.rows[0].place;
        }

        await db.query(`UPDATE ind_tournaments
            SET started = $1
            WHERE id = $2`,
            [1, id]);

        return orderedEntries;
    }

    static async generateNextRound(id) {
        const tournRes = await db.query(`SELECT current_round AS "currentRound"
            FROM ind_tournaments WHERE id = $1`, [id]);
        const nextRound = tournRes.rows[0].currentRound + 1;

        const entryRes = await db.query(`SELECT
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
            WHERE tournament = $1
            ORDER BY place ASC`, [id]);
        const entries = entryRes.rows;

        const pairings = generatePairings([...entries], nextRound);
        const games = [];

        for (let pairing of pairings) {
            if (!pairing.bye) {
                await db.query(`UPDATE ind_entries
                    SET prev_opponents = $1, prev_colors = $2
                    WHERE id = $3`,
                    [pairing.white.prevOpponents, pairing.white.prevColors, pairing.white.id]);
                await db.query(`UPDATE ind_entries
                    SET prev_opponents = $1, prev_colors = $2
                    WHERE id = $3`,
                    [pairing.black.prevOpponents, pairing.black.prevColors, pairing.black.id]);

                const gameRes = await db.query(`INSERT INTO ind_games (round, white, black, tournament)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, round, white, black, tournament`,
                    [nextRound, pairing.white.id, pairing.black.id, id]);
                games.push(gameRes.rows[0]);
            } else {
                const currentScoreRes = await db.query(`SELECT score
                    FROM ind_entries
                    WHERE id = $1`, [pairing.bye.id]);
                await db.query(`UPDATE ind_entries
                    SET score = $1, prev_opponents = $2, prev_colors = $3
                    WHERE id = $4`,
                    [currentScoreRes.rows[0].score + 1, pairing.bye.prevOpponents, pairing.bye.prevColors, pairing.bye.id]);

                const gameRes = await db.query(`INSERT INTO ind_games (round, white, black, tournament, result)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id, round, white, black, tournament, result`,
                    [nextRound, pairing.bye.id, null, id, '1-0']);
                games.push(gameRes.rows[0]);
            }
        }

        const finalTournRes = await db.query(`UPDATE ind_tournaments
            SET current_round = $1
            WHERE id = $2
            RETURNING
                id,
                director,
                name,
                time_control AS "timeControl",
                category,
                min_players AS "minPlayers",
                max_players AS "maxPlayers",
                rounds,
                round_length AS "roundLength",
                current_round AS "currentRound",
                registration_open AS "registrationOpen",
                registration_close AS "registrationClose",
                start_date AS "startDate"`,
            [nextRound, id]);
        const tournament = finalTournRes.rows[0];
        tournament.games = games;
        tournament.entries = entries;

        return tournament;
    }

    static async recordDoubleForfeits(id) {
        const roundRes = await db.query(`SELECT current_round AS "currentRound"
            FROM ind_tournaments
            WHERE id = $1`, [id]);
        const currentRound = roundRes.rows[0].currentRound;

        const gameRes = await db.query(`UPDATE ind_games
            SET result = $1
            WHERE tournament = $2 AND round = $3 AND result IS NULL
            RETURNING
                id
                round,
                white,
                black,
                tournament,
                result,
                url,
                schedule`,
            ['0-0', id, currentRound]);
        const games = gameRes.rows;

        return games;
    }

    static async updatePlaces(id) {
        const placeRes = await db.query(`SELECT id FROM ind_entries
            WHERE tournament = $1
            ORDER BY score DESC, seed`, [id]);
        const entries = placeRes.rows;

        for (let i = 0; i < entries.length; i++) {
            const nextRes = await db.query(`UPDATE ind_entries
                SET place = $1
                WHERE id = $2
                RETURNING place`,
                [i + 1, entries[i].id]);
            entries[i].place = nextRes.rows[0].place;
        }

        return entries;
    }

    static async calculateSonnebornBergerScores(id) {
        const entryRes = await db.query(`SELECT
                id,
                player,
                tournament,
                seed,
                rating,
                score,
                place
            FROM ind_entries
            WHERE tournament = $1`, [id]);
        const entries = entryRes.rows;

        const updatedEntries = [];
        for (let entry of [...entries]) {
            const gameRes = await db.query(`SELECT
                    white,
                    black,
                    result
                FROM ind_games
                WHERE white = $1 OR black = $1`,
                [entry.id]);
            const games = gameRes.rows;

            const score = await calculateSonnebornBergerScore(entry, [...games]);
            entry.sonnebornBergerScore = score;
            updatedEntries.push(entry);
        }

        for (let entry of updatedEntries) {
            await db.query(`UPDATE ind_entries
                SET sonneborn_berger_score = $1
                WHERE id = $2`,
                [entry.sonnebornBergerScore, entry.id]);
        }
    }

    static async setFinalPlaces(id) {
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
            WHERE tournament = $1
            ORDER BY score DESC, sonneborn_berger_score DESC, seed ASC`, [id]);
        const orderedEntries = res.rows;

        const finalEntries = [];
        for (let i = 0; i < orderedEntries.length; i++) {
            const nextRes = await db.query(`UPDATE ind_entries
                SET place = $1
                WHERE id = $2
                RETURNING
                    id,
                    player,
                    tournament,
                    seed,
                    rating,
                    score,
                    sonneborn_berger_score AS "sonnebornBergerScore",
                    place,
                    prev_opponents AS "prevOpponents",
                    prev_colors AS "prevColors"`,
                [i + 1, orderedEntries[i].id]);
            finalEntries.push(nextRes.rows[0]);
        }

        await db.query(`UPDATE ind_tournaments
            SET ended = $1
            WHERE id = $2`, [1, id])

        return finalEntries;
    }
}

module.exports = IndTournament;