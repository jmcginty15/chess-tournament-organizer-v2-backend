const express = require('express');
const IndGame = require('../models/ind_game');
const TeamGame = require('../models/team_game');
const { ensureGameParticipant, ensureTeamGameParticipant } = require('../middleware/auth');

const ExpressError = require('../expressError');

const router = new express.Router();

router.post('/ind/:id/schedule', ensureGameParticipant, async function (req, res, next) {
    try {
        const { id } = req.params;
        const game = await IndGame.schedule(id, req.body.schedule);
        return res.json({ game: game });
    } catch (err) {
        return next(err);
    }
});

router.post('/team/:id/schedule', ensureTeamGameParticipant, async function (req, res, next) {
    try {
        const { id } = req.params;
        const game = await TeamGame.schedule(id, req.body.schedule);
        return res.json({ game: game });
    } catch (err) {
        return next(err);
    }
});

router.post('/ind/:id/report', ensureGameParticipant, async function (req, res, next) {
    try {
        const { id } = req.params;
        const game = await IndGame.report(id, req.body.lichessId);
        return res.json({ game });
    } catch (err) {
        return next(err);
    }
});

router.post('/team/:id/report', ensureTeamGameParticipant, async function (req, res, next) {
    try {
        const { id } = req.params;
        const game = await TeamGame.report(id, req.body.lichessId);
        return res.json({ game });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;