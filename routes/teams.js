const express = require('express');
const Team = require('../models/team');
const { ensureTeamMember } = require('../middleware/auth');
const ExpressError = require('../expressError');

const router = new express.Router();

router.get('/:id', async function (req, res, next) {
    try {
        const { id } = req.params;
        const team = await Team.getById(id);
        return res.json({ team: team });
    } catch (err) {
        return next(err);
    }
});

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