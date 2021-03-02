const express = require('express');
const User = require('../models/user');
const jsonschema = require('jsonschema');
const updateUserSchema = require('../schemas/userUpdate.json');
const { ensureCorrectUser } = require('../middleware/auth');

const ExpressError = require('../expressError');

const router = new express.Router();

/** GET /:username
 * => { user: { username, email, firstName, lastName } }
 */

router.get('/:username', async function (req, res, next) {
    try {
        const { username } = req.params;
        const user = await User.getByUsername(username);
        return res.json({ user: user });
    } catch (err) {
        return next(err);
    }
});

/** GET /:username/tournaments
 * => { tournaments: [{ id, name, director, timeControl, category, minPlayers, maxPlayers, rounds, roundLength, currentRound, registrationOpen, registrationClose, startDate, started, ended }, ...] }
 */

router.get('/:username/tournaments', async function (req, res, next) {
    try {
        const { username } = req.params;
        const tournaments = await User.getTournaments(username);
        return res.json({ tournaments: tournaments });
    } catch (err) {
        return next(err);
    }
});

/** GET /:username/tournaments/ongoing
 * => { tournaments: [{ id, name, director, timeControl, category, minPlayers, maxPlayers, rounds, roundLength, currentRound, registrationOpen, registrationClose, startDate, started, ended }, ...] }
 */

router.get('/:username/tournaments/ongoing', async function (req, res, next) {
    try {
        const { username } = req.params;
        const tournaments = await User.getOngoingTournaments(username);
        return res.json({ tournaments: tournaments });
    } catch (err) {
        return next(err);
    }
});

/** GET /:username/directed_tournaments
 * => { tournaments: [{ id, name, director, timeControl, category, minPlayers, maxPlayers, rounds, roundLength, currentRound, registrationOpen, registrationClose, startDate, started, ended }, ...] }
 */

router.get('/:username/directed_tournaments', async function (req, res, next) {
    try {
        const { username } = req.params;
        const tournaments = await User.getDirectedTournaments(username);
        return res.json({ tournaments: tournaments });
    } catch (err) {
        return next(err);
    }
});

/** PATCH /:username/update
 * { username, password, email, firstName, lastName } => { username, email, firstName, lastName }
 */

router.patch('/:username/update', async function (req, res, next) {
    try {
        const validUser = jsonschema.validate(req.body, updateUserSchema);
        if (!validUser.valid) throw new ExpressError('Bad request', 400);

        const { username } = req.params;
        const userInfo = req.body;
        delete userInfo._token;
        const updatedUser = await User.update(username, userInfo);
        return res.json({ user: updatedUser });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;