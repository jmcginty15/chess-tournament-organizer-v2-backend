const db = require('../db');
const ExpressError = require('../expressError');
const axios = require('axios');
const { API_URL } = require('../config');
const {
    batchify,
    unbatchify,
    delay,
    getCategory,
    getRating,
    assignInitialPlaces,
    generatePairings,
    assignTeams,
    averageRating
} = require('../helpers/tournaments');
const { generateGames } = require('../helpers/matches');
const { updateIndRating } = require('../helpers/entries');
const Team = require('./team');

class TeamTournament {
    static async create({
        director,
        name,
        timeControl,
        minPlayers,
        maxPlayers,
        teamSize,
        rounds,
        roundLength,
        registrationOpen,
        registrationClose,
        startDate
    }) {
        const dupNameCheck = await db.query(`SELECT name FROM team_tournaments WHERE name = $1`, [name]);
        if (dupNameCheck.rows.length) throw new ExpressError('Duplicate name', 400);
        const category = getCategory(timeControl);

        const res = await db.query(`INSERT INTO team_tournaments
            (director, name, time_control, category, min_players, max_players, team_size, rounds, round_length, current_round, registration_open, registration_close, start_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING
                id,
                director,
                name,
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
                start_date AS "startDate"`,
            [director, name, timeControl, category, minPlayers, maxPlayers, teamSize, rounds, roundLength, 0, registrationOpen, registrationClose, startDate]);
        const tournament = res.rows[0];
        tournament.teams = [];

        await db.query(`INSERT INTO teams (name, tournament, rating, seed, score, sonneborn_berger_score, place, prev_opponents, prev_colors)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            ['Team A', tournament.id, 0, 0, 0, 0, 0, '', '']);

        return tournament;
    }

    static async getAll() {
        const res = await db.query(`SELECT
                id,
                director,
                name,
                time_control AS "timeControl",
                category,
                team_size AS "teamSize",
                rounds,
                round_length AS "roundLength",
                current_round AS "currentRound",
                registration_open AS "registrationOpen",
                registration_close AS "registrationClose",
                start_date AS "startDate"
            FROM team_tournaments`);
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
                team_size AS "teamSize",
                rounds,
                round_length AS "roundLength",
                current_round AS "currentRound",
                registration_open AS "registrationOpen",
                registration_close AS "registrationClose",
                start_date AS "startDate"
            FROM team_tournaments WHERE id = $1`, [id]);
        const tournament = tournRes.rows[0];

        if (!tournament) throw new ExpressError(`Tournament id ${id} not found`, 404);

        const entryRes = await db.query(`SELECT team_entries.id, team_entries.player, team_entries.rating
            FROM team_entries
            FULL JOIN teams ON teams.id = team_entries.team
            WHERE tournament = $1
            ORDER BY rating DESC`, [id]);
        if (entryRes.rows[0].id) tournament.entries = entryRes.rows;
        else tournament.entries = [];

        const teamRes = await db.query(`SELECT
                id,
                name,
                rating,
                seed,
                score,
                sonneborn_berger_score AS "sonnebornBergerScore",
                place,
                prev_opponents AS "prevOpponents",
                prev_colors AS "prevColors"
            FROM teams
            WHERE tournament = $1
            ORDER BY score DESC, seed`, [id]);
        tournament.teams = teamRes.rows;

        return tournament;
    }

    static async enter(id, username) {
        const tournRes = await db.query(`SELECT category FROM team_tournaments WHERE id = $1`, [id]);
        const tournament = tournRes.rows[0];
        if (!tournament) throw new ExpressError(`Tournament id ${id} not found`, 404);

        const userRes = await db.query(`SELECT username FROM users WHERE username = $1`, [username]);
        const user = userRes.rows[0];
        if (!user) throw new ExpressError(`User ${username} not found`, 404);

        const lichessUserRes = await axios.get(`${API_URL}/api/user/${username}`);
        const ratings = lichessUserRes.data.perfs;

        const rating = getRating(ratings, tournament.category);

        const teamRes = await db.query(`SELECT id FROM teams WHERE tournament = $1`, [id]);
        const teamId = teamRes.rows[0].id;

        const entryRes = await db.query(`INSERT INTO team_entries (player, team, rating)
            VALUES ($1, $2, $3)
            RETURNING
                player,
                team,
                rating`,
            [username, teamId, rating]);
        const entry = entryRes.rows[0];

        return entry;
    }

    static async updateAllRatings(id) {
        const tournRes = await db.query(`SELECT category FROM team_tournaments WHERE id = $1`, [id]);
        const { category } = tournRes.rows[0];

        const entryRes = await db.query(`SELECT
                team_entries.id,
                team_entries.player,
                team_entries.team,
                team_entries.rating
            FROM team_entries
            FULL JOIN teams ON teams.id = team_entries.team
            WHERE tournament = $1`, [id]);
        const entryBatches = batchify(entryRes.rows, 15);

        let i = 0;
        for (let batch of entryBatches) {
            const promises = batch.map(entry => updateIndRating(entry, category));
            await Promise.all(promises).then(async batch => {
                for (let entry of batch) {
                    await db.query(`UPDATE team_entries SET rating = $1
                        WHERE player = $2 AND team = $3`,
                        [entry.rating, entry.player, entry.team]);
                }
            });
            i++;
            if (i < entryBatches.length) delay(4000);
        }

        const entries = unbatchify(entryBatches);
        return entries;
    }

    static async assignTeams(id) {
        const tournRes = await db.query(`SELECT
                id,
                director,
                name,
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
                start_date AS "startDate"
            FROM team_tournaments WHERE id = $1`, [id]);
        const tournament = tournRes.rows[0];

        const entryRes = await db.query(`SELECT
                team_entries.id,
                team_entries.player,
                team_entries.team,
                team_entries.rating
            FROM team_entries
            FULL JOIN teams ON teams.id = team_entries.team
            WHERE tournament = $1
            ORDER BY rating DESC`, [id]);
        const entries = entryRes.rows;

        const teamCount = entries.length / tournament.teamSize;
        const teams = assignTeams(entries, teamCount);

        const finalTeams = [];
        for (let i = 0; i < teams.length; i++) {
            let teamRes = null;
            if (i === 0) {
                teamRes = await db.query(`UPDATE teams
                    SET rating = $1
                    WHERE tournament = $2
                    RETURNING
                        id,
                        name,
                        tournament,
                        rating
                        seed,
                        score,
                        sonneborn_berger_score AS "sonnebornBergerScore",
                        place,
                        prev_opponents AS "prevOpponents",
                        prev_colors AS "prevColors"`,
                    [averageRating(teams[i]), id]);
                finalTeams.push(teamRes.rows[0]);
            } else {
                teamRes = await db.query(`INSERT INTO teams (name, tournament, rating, seed, score, sonneborn_berger_score, place, prev_opponents, prev_colors)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
                    [`Team ${String.fromCharCode(i + 65)}`, id, averageRating(teams[i]), 0, 0, 0, 0, '', '']);
                finalTeams.push(teamRes.rows[0]);
            }

            for (let entry of teams[i]) {
                await db.query(`UPDATE team_entries
                    SET team = $1
                    WHERE id = $2`,
                    [teamRes.rows[0].id, entry.id]);
            }
        }

        return finalTeams;
    }

    static async assignSeeds(id) {
        const res = await db.query(`SELECT
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
            WHERE tournament = $1
            ORDER BY rating DESC`, [id]);
        const teams = res.rows;
        const orderedTeams = assignInitialPlaces(teams);

        for (let i = 0; i < orderedTeams.length; i++) {
            const nextRes = await db.query(`UPDATE teams
                SET seed = $1, place = $1
                WHERE id = $2 AND tournament = $3
                RETURNING seed, place`,
                [i + 1, orderedTeams[i].id, id]);
            orderedTeams[i].seed = nextRes.rows[0].seed;
            orderedTeams[i].place = nextRes.rows[0].place;
        }

        return orderedTeams;
    }

    static async generateNextRound(id) {
        const tournRes = await db.query(`SELECT current_round AS "currentRound"
            FROM team_tournaments WHERE id = $1`, [id]);
        const nextRound = tournRes.rows[0].currentRound + 1;

        const teamRes = await db.query(`SELECT
                id,
                name,
                tournament,
                seed,
                rating,
                score,
                sonneborn_berger_score AS "sonnebornBergerScore",
                place,
                prev_opponents AS "prevOpponents",
                prev_colors AS "prevColors"
            FROM teams
            WHERE tournament = $1
            ORDER BY place ASC`, [id]);
        const teams = teamRes.rows;

        const pairings = generatePairings(teams, nextRound);
        for (let pairing of pairings) {
            if (!pairing.bye) {
                pairing.team1 = pairing.white;
                pairing.team2 = pairing.black;
                delete pairing.white;
                delete pairing.black;
            }
        }

        const matches = [];
        for (let pairing of pairings) {
            const matchRes = await db.query(`INSERT INTO team_matches (team_1, team_2)
                VALUES ($1, $2)
                RETURNING id, team_1 AS "team1", team_2 AS "team2", result`,
                [pairing.team1.id, pairing.team2.id]);
            matches.push(matchRes.rows[0]);
        }

        for (let match of matches) {
            const team1 = await Team.getById(match.team1);
            const team2 = await Team.getById(match.team2);
            const games = generateGames(team1, team2);
            match.games = games;

            for (let game of games) {
                await db.query(`INSERT INTO team_games (white, black)
                    VALUES ($1, $2)`, [game.white.id, game.black.id]);
            }
        }

        return matches;
    }
}

module.exports = TeamTournament;