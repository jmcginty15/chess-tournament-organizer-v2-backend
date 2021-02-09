const express = require('express');
const User = require('../models/user');
const { ensureLoggedIn } = require('../middleware/auth');

const ExpressError = require('../expressError');

const router = new express.Router();

router.get('/:username', ensureLoggedIn, async function (req, res, next) {
    try {
        const { username } = req.params;
        const user = await User.getByUsername(username);
        return res.json({ user: user });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;