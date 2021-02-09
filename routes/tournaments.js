const express = require('express');
const IndTournament = require('../models/ind_tournament');
const TeamTournament = require('../models/team_tournament');
const jsonschema = require('jsonschema');
const newIndTournamentSchema = require('../schemas/indTournamentNew.json');
const { ensureLoggedIn, ensureCorrectUser } = require('../middleware/auth');

const ExpressError = require('../expressError');

const router = new express.Router();

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

router.get('/ind/:id', async function (req, res, next) {
    try {
        const { id } = req.params;
        const tournament = await IndTournament.getById(id);
        return res.json({ tournament: tournament });
    } catch (err) {
        return next(err);
    }
});

router.post('/ind/:id/:username/enter', ensureCorrectUser, async function (req, res, next) {
    try {
        const { id, username } = req.params;
        const entry = await IndTournament.enter(id, username);
        return res.json({ entry: entry });
    } catch (err) {
        return next(err);
    }
});

router.post('/ind/:id/initialize', async function (req, res, next) {
    try {
        const { id } = req.params;
        await IndTournament.updateAllRatings(id);
        const result = await IndTournament.assignSeeds(id);
        return res.json({ result });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;