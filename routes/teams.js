const express = require('express');
const Team = require('../models/team');
const { ensureTeamMember } = require('../middleware/auth');

const router = new express.Router();

/** GET /:id
 * => { id, name, tournament, rating, seed, score, sonnebornBergerScore, place, prevOpponents, prevColots }
 */

router.get('/:id', async function (req, res, next) {
    try {
        const { id } = req.params;
        const team = await Team.getById(id);
        return res.json({ team: team });
    } catch (err) {
        return next(err);
    }
});

/** PATCH /:id/rename
 * => { id, name, tournament, rating, seed, score, sonnebornBergerScore, place, prevOpponents, prevColots }
 */

router.patch('/:id/rename', ensureTeamMember, async function (req, res, next) {
    try {
        const { id } = req.params;
        const team = await Team.rename(id, req.body.newName);
        return res.json({ team: team });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;