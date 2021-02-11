const db = require('../db');
const ExpressError = require('../expressError');
const axios = require('axios');
const { API_URL } = require('../config');
const { batchify, unbatchify, delay, getCategory, getRating, assignInitialPlaces, generatePairings } = require('../helpers/tournaments');
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
            (director, name, time_control, category, min_players, max_players, rounds, round_length, current_round, registration_open, registration_close, start_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
            [director, name, timeControl, category, minPlayers, maxPlayers, rounds, roundLength, 0, registrationOpen, registrationClose, startDate]);
        const tournament = res.rows[0];
        return tournament;
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
            FROM ind_tournaments`);
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
                start_date AS "startDate"
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
            WHERE tournament = $1`, [id]);
        tournament.entries = entryRes.rows;

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

        const lichessUserRes = await axios.get(`${API_URL}/user/${username}`);
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

        const pairings = generatePairings(entries, nextRound);
        return pairings;
    }
}

module.exports = IndTournament;