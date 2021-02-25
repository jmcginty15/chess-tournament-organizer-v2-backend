const express = require('express');
const IndEntry = require('../models/ind_entry');
// const TeamEntry = require('../models/team_entry');

const ExpressError = require('../expressError');

const router = new express.Router();

router.get('/ind/:id', async function (req, res, next) {
    try {
        const { id } = req.params;
        const entry = await IndEntry.getById(id);
        return res.json({ entry: entry });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;