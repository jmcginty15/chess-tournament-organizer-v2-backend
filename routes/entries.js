const express = require('express');
const IndEntry = require('../models/ind_entry');
const TeamEntry = require('../models/team_entry');

const ExpressError = require('../expressError');

const router = new express.Router();

/** GET /ind/:id
 * => { id, player, tournament, seed, rating, score, sonnebornBergerScore, place, prevOpponents, prevColors }
 */

router.get('/ind/:id', async function (req, res, next) {
    try {
        const { id } = req.params;
        const entry = await IndEntry.getById(id);
        return res.json({ entry: entry });
    } catch (err) {
        return next(err);
    }
});

/** GET /team/:id
 * => { id, player, team, rating }
 */

 router.get('/team/:id', async function (req, res, next) {
    try {
        const { id } = req.params;
        const entry = await TeamEntry.getById(id);
        return res.json({ entry: entry });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;