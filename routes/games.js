const express = require('express');
const IndGame = require('../models/ind_game');
const TeamGame = require('../models/team_game');
const { ensureGameParticipant, ensureTeamGameParticipant, ensureTournamentDirector } = require('../middleware/auth');

const router = new express.Router();

/** POST /ind/:id/schedule
 * { schedule } => { id, round, white, black, tournament, result, schedule }
 */

router.post('/ind/:id/schedule', ensureGameParticipant, async function (req, res, next) {
    try {
        const { id } = req.params;
        const game = await IndGame.schedule(id, req.body.schedule);
        return res.json({ game: game });
    } catch (err) {
        return next(err);
    }
});

/** POST /team/:id/schedule
 * { schedule } => { id, white, black, match, result, schedule }
 */

router.post('/team/:id/schedule', ensureTeamGameParticipant, async function (req, res, next) {
    try {
        const { id } = req.params;
        const game = await TeamGame.schedule(id, req.body.schedule);
        return res.json({ game: game });
    } catch (err) {
        return next(err);
    }
});

/** POST /ind/:id/report
 * { lichessId } => { id, round, white, black, tournament, result, url, schedule }
 */

router.post('/ind/:id/report', ensureGameParticipant, async function (req, res, next) {
    try {
        const { id } = req.params;
        const game = await IndGame.report(id, req.body.lichessId);
        return res.json({ game });
    } catch (err) {
        return next(err);
    }
});

/** POST /team/:id/report
 * { lichessId } => { id, white, black, match, result, url, schedule }
 */

router.post('/team/:id/report', ensureTeamGameParticipant, async function (req, res, next) {
    try {
        const { id } = req.params;
        const game = await TeamGame.report(id, req.body.lichessId);
        return res.json({ game });
    } catch (err) {
        return next(err);
    }
});

/** POST /ind/:id/forfeit
 * { winner } => { id, round, white, black, tournament, result, url, schedule }
 */

router.post('/ind/:id/forfeit', ensureTournamentDirector, async function(req, res, next) {
    try {
        const { id } = req.params;
        const game = await IndGame.forfeit(id, req.body.winner);
        return res.json({ game });
    } catch (err) {
        return next(err);
    }
});

/** POST /team/:id/forfeit
 * { winner } => { id, white, black, match, result, url, schedule }
 */

router.post('/team/:id/forfeit', ensureTournamentDirector, async function (req, res, next) {
    try {
        const { id } = req.params;
        const game = await TeamGame.forfeit(id, req.body.winner);
        return res.json({ game });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;