const express = require('express');
const IndTournament = require('../models/ind_tournament');
const TeamTournament = require('../models/team_tournament');
const jsonschema = require('jsonschema');
const newIndTournamentSchema = require('../schemas/indTournamentNew.json');
const newTeamTournamentSchema = require('../schemas/teamTournamentNew.json');
const { ensureLoggedIn, ensureCorrectUser, ensureTournamentDirector, ensureTeamTournamentDirector } = require('../middleware/auth');

const ExpressError = require('../expressError');

const router = new express.Router();

/** POST /ind/create
 * { director, name, timeControl, minPlayers, maxPlayers, rounds, roundLength, registrationOpen, registrationClose, startDate }
 * => { tournament: { id, director, name, timeControl, category, minPlayers, maxPlayers, rounds, roundLength, currentRound, registrationOpen, registrationClose, startDate, started, ended } }
 */

router.post('/ind/create', ensureLoggedIn, async function (req, res, next) {
    try {
        const validRequest = jsonschema.validate(req.body, newIndTournamentSchema);
        if (!validRequest) throw new ExpressError('Bad request', 400);

        const newTournament = await IndTournament.create(req.body);
        return res.json({ tournament: newTournament });
    } catch (err) {
        return next(err);
    }
});

/** POST /team/create
 * { director, name, timeControl, minPlayers, maxPlayers, teamSize, rounds, roundLength, registrationOpen, registrationClose, startDate }
 * => { tournament: { id, director, name, timeControl, category, minPlayers, maxPlayers, teamSize, rounds, roundLength, currentRound, registrationOpen, registrationClose, startDate, started, ended } }
 */

router.post('/team/create', ensureLoggedIn, async function (req, res, next) {
    try {
        const validRequest = jsonschema.validate(req.body, newTeamTournamentSchema);
        if (!validRequest) throw new ExpressError('Bad request', 400);

        const newTournament = await TeamTournament.create(req.body);
        return res.json({ tournament: newTournament });
    } catch (err) {
        return next(err);
    }
});

/** GET /ind/all
 * => { tournaments: [{ id, director, name, timeControl, category, rounds, roundLength, currentRound, registrationOpen, registrationClose, startDate }, ...] }
 */

router.get('/ind/all', async function (req, res, next) {
    try {
        const tournaments = await IndTournament.getAll();
        return res.json({ tournaments: tournaments });
    } catch (err) {
        return next(err);
    }
});

/** GET /team/all
 * => { tournaments: [{ id, director, name, timeControl, category, teamSize, rounds, roundLength, currentRound, registrationOpen, registrationClose, startDate }, ...] }
 */

router.get('/team/all', async function (req, res, next) {
    try {
        const tournaments = await TeamTournament.getAll();
        return res.json({ tournaments: tournaments });
    } catch (err) {
        return next(err);
    }
});

/** GET /ind/:id
 * => { tournament: { id, director, name, timeControl, category, minPlayers, maxPlayers, rounds, roundLength, currentRound, registrationOpen, registrationClose, startDate, started, ended } } }
 */

router.get('/ind/:id', async function (req, res, next) {
    try {
        const { id } = req.params;
        const tournament = await IndTournament.getById(id);
        return res.json({ tournament: tournament });
    } catch (err) {
        return next(err);
    }
});

/** GET /team/:id
 * => { tournament: { id, director, name, timeControl, category, minPlayers, maxPlayers, teamSize, rounds, roundLength, currentRound, registrationOpen, registrationClose, startDate, started, ended } }
 */

router.get('/team/:id', async function (req, res, next) {
    try {
        const { id } = req.params;
        const tournament = await TeamTournament.getById(id);
        return res.json({ tournament: tournament });
    } catch (err) {
        return next(err);
    }
});

/** POST /ind/:id/:username/enter
 * => { entry: { player, tournament, seed, rating, score, sonnebornBergerScore, place, prevOpponents, prevColors } }
 */

router.post('/ind/:id/:username/enter', ensureCorrectUser, async function (req, res, next) {
    try {
        const { id, username } = req.params;
        const entry = await IndTournament.enter(id, username);
        return res.json({ entry: entry });
    } catch (err) {
        return next(err);
    }
});

/** POST /team/:id/:username/enter
 * => { entry: { player, team, rating } }
 */

router.post('/team/:id/:username/enter', ensureCorrectUser, async function (req, res, next) {
    try {
        const { id, username } = req.params;
        const entry = await TeamTournament.enter(id, username);
        return res.json({ entry: entry });
    } catch (err) {
        return next(err);
    }
});

/** POST /ind/:id/initialize
 * => { tournament: {
 *      id,
 *      director,
 *      name,
 *      timeControl,
 *      category,
 *      minPlayers,
 *      maxPlayers,
 *      rounds,
 *      roundLength,
 *      currentRound,
 *      registrationOpen,
 *      registrationClose,
 *      startDate,
 *      games: [{ id, round, white, black, tournament }, ...],
 *      entries: [{ id, player, tournament, seed, rating, score, sonnebornBergerScore, place, prevOpponents, prevColors }, ...]
 * } }
 */

router.post('/ind/:id/initialize', ensureTournamentDirector, async function (req, res, next) {
    try {
        const { id } = req.params;
        await IndTournament.updateAllRatings(id);
        await IndTournament.assignSeeds(id);
        const tournament = await IndTournament.generateNextRound(id);
        return res.json({ tournament: tournament });
    } catch (err) {
        return next(err);
    }
});

/** POST /team/:id/initialize
 * => { tournament: {
 *      id,
 *      director,
 *      name,
 *      timeControl,
 *      category,
 *      minPlayers,
 *      maxPlayers,
 *      teamSize,
 *      rounds,
 *      roundLength,
 *      currentRound,
 *      registrationOpen,
 *      registrationClose,
 *      startDate,
 *      entries: [{ player, team, rating }, ...],
 *      teams: [{ id, name, tournament, seed, rating, score, sonnebornBergerScore, place, prevOpponents, prevColors }, ...],
 *      matches: [{ id, round, team1, team2, tournament, result }, ...]
 *  } }
 */

 router.post('/team/:id/initialize', ensureTeamTournamentDirector, async function (req, res, next) {
    try {
        const { id } = req.params;
        await TeamTournament.removeExtraPlayers(id);
        await TeamTournament.updateAllRatings(id);
        await TeamTournament.assignTeams(id);
        await TeamTournament.assignSeeds(id);
        const tournament = await TeamTournament.generateNextRound(id);
        return res.json({ tournament: tournament });
    } catch (err) {
        return next(err);
    }
});

/** POST /ind/:id/end_round
 * => { tournament: {
 *      id,
 *      director,
 *      name,
 *      timeControl,
 *      category,
 *      minPlayers,
 *      maxPlayers,
 *      rounds,
 *      roundLength,
 *      currentRound,
 *      registrationOpen,
 *      registrationClose,
 *      startDate,
 *      games: [{ id, round, white, black, tournament }, ...],
 *      entries: [{ id, player, tournament, seed, rating, score, sonnebornBergerScore, place, prevOpponents, prevColors }, ...]
 * } }
 */

router.post('/ind/:id/end_round', ensureTournamentDirector, async function (req, res, next) {
    try {
        const { id } = req.params;
        await IndTournament.recordDoubleForfeits(id);
        await IndTournament.updatePlaces(id);
        const tournament = await IndTournament.generateNextRound(id);
        return res.json({ tournament: tournament });
    } catch (err) {
        return next(err);
    }
});

/** POST /team/:id/end_round
 * => { tournament: {
 *      id,
 *      director,
 *      name,
 *      timeControl,
 *      category,
 *      minPlayers,
 *      maxPlayers,
 *      teamSize,
 *      rounds,
 *      roundLength,
 *      currentRound,
 *      registrationOpen,
 *      registrationClose,
 *      startDate,
 *      entries: [{ player, team, rating }, ...],
 *      teams: [{ id, name, tournament, seed, rating, score, sonnebornBergerScore, place, prevOpponents, prevColors }, ...],
 *      matches: [{ id, round, team1, team2, tournament, result }, ...]
 *  } }
 */

router.post('/team/:id/end_round', ensureTeamTournamentDirector, async function (req, res, next) {
    try {
        const { id } = req.params;
        await TeamTournament.recordDoubleForfeits(id);
        await TeamTournament.updatePlaces(id);
        const tournament = await TeamTournament.generateNextRound(id);
        return res.json({ tournament: tournament });
    } catch (err) {
        return next(err);
    }
});

/** POST /ind/:id/end_tournament
 * => { entries: [{ id, player, tournament, seed, rating, score, sonnebornBergerScore, place, prevOpponents, prevColors }, ...] }
 */

router.post('/ind/:id/end_tournament', ensureTournamentDirector, async function (req, res, next) {
    try {
        const { id } = req.params;
        await IndTournament.recordDoubleForfeits(id);
        await IndTournament.calculateSonnebornBergerScores(id);
        const entries = await IndTournament.setFinalPlaces(id);
        return res.json({ entries: entries });
    } catch (err) {
        return next(err);
    }
});

/** POST /team/:id/end_tournament
 * => { teams: [{ id, name, tournament, seed, rating, score, sonnebornBergerScore, place, prevOpponents, prevColors }, ...] }
 */

router.post('/team/:id/end_tournament', ensureTeamTournamentDirector, async function (req, res, next) {
    try {
        const { id } = req.params;
        await TeamTournament.recordDoubleForfeits(id);
        await TeamTournament.calculateSonnebornBergerScores(id);
        const teams = await TeamTournament.setFinalPlaces(id);
        return res.json({ teams: teams });
    } catch (err) {
        return next(err);
    }
});

/** DELETE /ind/:id
 * => { message: 'deleted' }
 */

router.delete('/ind/:id', ensureTournamentDirector, async function (req, res, next) {
    try {
        const { id } = req.params;
        const message = await IndTournament.delete(id);
        return res.json({ message: message });
    } catch (err) {
        return next(err);
    }
});

/** DELETE /team/:id
 * => { message: 'deleted' }
 */

router.delete('/team/:id', ensureTeamTournamentDirector, async function (req, res, next) {
    try {
        const { id } = req.params;
        const message = await TeamTournament.delete(id);
        return res.json({ message: message });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;