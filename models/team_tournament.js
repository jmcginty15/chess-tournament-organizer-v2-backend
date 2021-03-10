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
    averageRating,
    calculateTeamSonnebornBergerScore
} = require('../helpers/tournaments');
const { generateGames } = require('../helpers/matches');
const { updateIndRating } = require('../helpers/entries');
const Team = require('./team');

// Team tournament
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
        /** Creates a tournament */
        const dupNameCheck = await db.query(`SELECT name FROM team_tournaments WHERE name = $1`, [name]);
        if (dupNameCheck.rows.length) throw new ExpressError('Duplicate name', 400);
        const category = getCategory(timeControl);

        const res = await db.query(`INSERT INTO team_tournaments
            (director, name, time_control, category, min_players, max_players, team_size, rounds, round_length, current_round, registration_open, registration_close, start_date, started, ended)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
                start_date AS "startDate",
                started,
                ended`,
            [director, name, timeControl, category, minPlayers, maxPlayers, teamSize, rounds, roundLength, 0, registrationOpen, registrationClose, startDate, 0, 0]);
        const tournament = res.rows[0];
        tournament.teams = [];

        await db.query(`INSERT INTO teams (name, tournament, rating, seed, score, sonneborn_berger_score, place, prev_opponents, prev_colors)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            ['Team A', tournament.id, 0, 0, 0, 0, 0, '', '']);

        return tournament;
    }

    static async delete(id) {
        /** Deletes a tournament */
        await db.query(`DELETE FROM team_tournaments WHERE id = $1`, [id]);
        return 'deleted';
    }

    static async getAll() {
        /** Gets a list of all team tournaments */
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
            FROM team_tournaments
            ORDER BY start_date DESC`);
        const tournaments = res.rows;
        return tournaments;
    }

    static async getById(id) {
        /** Gets a single tournament by id */
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
                start_date AS "startDate",
                started,
                ended
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
            ORDER BY place`, [id]);
        tournament.teams = teamRes.rows;

        const matchRes = await db.query(`SELECT
                id,
                round,
                team_1 AS "team1",
                team_2 AS "team2",
                tournament,
                result
            FROM team_matches
            WHERE tournament = $1
            ORDER BY id`, [id]);
        const matches = matchRes.rows;

        for (let match of matches) {
            const gameRes = await db.query(`SELECT
                    id,
                    white,
                    black,
                    match,
                    result,
                    url,
                    schedule
                FROM team_games
                WHERE match = $1
                ORDER BY id`, [match.id]);
            match.games = gameRes.rows;
        }
        tournament.matches = matches;

        return tournament;
    }

    static async enter(id, username) {
        /** Enters a user into a tournament */
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

    static async removeExtraPlayers(id) {
        /** In the case that the number of entries is not an even multiple of the number of players per team,
         * remove the excess players
         */
        const tournament = await TeamTournament.getById(id);
        const extraPlayers = tournament.entries.length % tournament.teamSize;

        const entryRes = await db.query(`SELECT team_entries.id FROM team_entries
            JOIN teams ON teams.id = team_entries.team
            WHERE teams.tournament = $1
            ORDER BY team_entries.id DESC
            LIMIT $2`,
            [id, extraPlayers]);
        const removedPlayers = entryRes.rows;

        for (let player of removedPlayers) await db.query(`DELETE FROM team_entries WHERE id = $1`, [player.id]);
    }

    static async updateAllRatings(id) {
        /** Updates ratings for all players in the tournament */
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
        /** Assigns players to teams in order to balance teams by rating */
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
        /** Assigns seeds to all teams based on rating */
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
        /** Generates matches and games for the next round of a tournament */
        const tournRes = await db.query(`SELECT current_round AS "currentRound", team_size AS "teamSize"
            FROM team_tournaments WHERE id = $1`, [id]);
        const nextRound = tournRes.rows[0].currentRound + 1;
        const teamSize = tournRes.rows[0].teamSize;

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

        const pairings = generatePairings([...teams], nextRound);
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
            if (!pairing.bye) {
                await db.query(`UPDATE teams
                    SET prev_opponents = $1, prev_colors = $2
                    WHERE id = $3`,
                    [pairing.team1.prevOpponents, pairing.team1.prevColors, pairing.team1.id]);
                await db.query(`UPDATE teams
                    SET prev_opponents = $1, prev_colors = $2
                    WHERE id = $3`,
                    [pairing.team2.prevOpponents, pairing.team2.prevColors, pairing.team2.id]);

                const matchRes = await db.query(`INSERT INTO team_matches (round, team_1, team_2, tournament)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, round, team_1 AS "team1", team_2 AS "team2", tournament, result`,
                    [nextRound, pairing.team1.id, pairing.team2.id, id]);
                matches.push(matchRes.rows[0]);
            } else {
                const currentScoreRes = await db.query(`SELECT score
                    FROM teams
                    WHERE id = $1`, [pairing.bye.id]);
                await db.query(`UPDATE teams
                    SET score = $1, prev_opponents = $2, prev_colors = $3
                    WHERE id = $4`,
                    [currentScoreRes.rows[0].score + teamSize, pairing.bye.prevOpponents, pairing.bye.prevColors, pairing.bye.id]);

                const matchRes = await db.query(`INSERT INTO team_matches (round, team_1, team_2, tournament, result)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id, round, team_1 AS "team1", team_2 AS "team2", tournament, result`,
                    [nextRound, pairing.bye.id, null, id, `${teamSize}-0`]);
                matches.push(matchRes.rows[0]);
            }
        }

        for (let match of matches) {
            const team1 = await Team.getById(match.team1);

            if (match.team2) {
                const team2 = await Team.getById(match.team2);
                const games = generateGames(team1, team2);
                match.games = games;

                for (let game of games) {
                    await db.query(`INSERT INTO team_games (white, black, match)
                        VALUES ($1, $2, $3)`, [game.white.id, game.black.id, match.id]);
                }
            }
        }

        const finalTournRes = await db.query(`UPDATE team_tournaments
            SET current_round = $1, started = $2
            WHERE id = $3
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
                start_date AS "startDate",
                started,
                ended`,
            [nextRound, 1, id]);

        const tournament = finalTournRes.rows[0];

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

        tournament.entries = entries;
        tournament.teams = teams;
        tournament.matches = matches;

        return tournament;
    }

    static async recordDoubleForfeits(id) {
        /** Enters 0-0 results for any games not reports */
        const roundRes = await db.query(`SELECT current_round AS "currentRound"
            FROM team_tournaments
            WHERE id = $1`, [id]);
        const currentRound = roundRes.rows[0].currentRound;

        const matchRes = await db.query(`SELECT id
            FROM team_matches
            WHERE round = $1 AND tournament = $2`,
            [currentRound, id]);
        const matches = matchRes.rows;

        let games = [];
        for (let match of matches) {
            const gameRes = await db.query(`UPDATE team_games
                SET result = $1
                WHERE match = $2 AND result IS NULL
                RETURNING
                    id,
                    white,
                    black,
                    match,
                    result,
                    url,
                    schedule`,
                ['0-0', match.id]);
            games = [...games, ...gameRes.rows];
        }

        return games;
    }

    static async updatePlaces(id) {
        /** Updates current rankings for all teams based on score */
        const placeRes = await db.query(`SELECT id FROM teams
            WHERE tournament = $1
            ORDER BY score DESC, seed`, [id]);
        const teams = placeRes.rows;

        for (let i = 0; i < teams.length; i++) {
            const nextRes = await db.query(`UPDATE teams
                SET place = $1
                WHERE id = $2
                RETURNING place`,
                [i + 1, teams[i].id]);
            teams[i].place = nextRes.rows[0].place;
        }

        return teams;
    }

    static async calculateSonnebornBergerScores(id) {
        /** Enters Sonneborn-Berger scores for tiebreaking purposes after the final round */
        const teamRes = await db.query(`SELECT
                id,
                name,
                tournament,
                seed,
                rating,
                score,
                place
            FROM teams
            WHERE tournament = $1`, [id]);
        const teams = teamRes.rows;

        const updatedTeams = [];
        for (let team of [...teams]) {
            const matchRes = await db.query(`SELECT
                    team_1 AS "team1",
                    team_2 AS "team2",
                    result
                FROM team_matches
                WHERE team_1 = $1 OR team_2 = $1`,
                [team.id]);
            const matches = matchRes.rows;

            const score = await calculateTeamSonnebornBergerScore(team, [...matches]);
            team.sonnebornBergerScore = score;
            updatedTeams.push(team);
        }

        for (let team of updatedTeams) {
            await db.query(`UPDATE teams
                SET sonneborn_berger_score = $1
                WHERE id = $2`,
                [team.sonnebornBergerScore, team.id]);
        }
    }

    static async setFinalPlaces(id) {
        /** Updates places based on score and Sonneborn-Berger score after the final round */
        const res = await db.query(`SELECT
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
            ORDER BY score DESC, sonneborn_berger_score DESC, seed ASC`, [id]);
        const orderedTeams = res.rows;

        const finalTeams = [];
        for (let i = 0; i < orderedTeams.length; i++) {
            const nextRes = await db.query(`UPDATE teams
                SET place = $1
                WHERE id = $2
                RETURNING
                    id,
                    name,
                    tournament,
                    seed,
                    rating,
                    score,
                    sonneborn_berger_score AS "sonnebornBergerScore",
                    place,
                    prev_opponents AS "prevOpponents",
                    prev_colors AS "prevColors"`,
                [i + 1, orderedTeams[i].id]);
            finalTeams.push(nextRes.rows[0]);
        }

        await db.query(`UPDATE team_tournaments
            SET ended = $1
            WHERE id = $2`, [1, id]);

        return finalTeams;
    }
}

module.exports = TeamTournament;