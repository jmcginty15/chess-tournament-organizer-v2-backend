const express = require('express');
const User = require('../models/user');
const jsonschema = require('jsonschema');
const newUserSchema = require('../schemas/userNew.json');
const { createToken } = require('../helpers/auth');
const { DB_URI } = require('../config');

const ExpressError = require('../expressError');

const router = new express.Router();

router.post('/login', async function (req, res, next) {
    try {
        const user = await User.login(req.body.username, req.body.password);
        const token = createToken(user);
        return res.json({ user: user, _token: token });
    } catch (err) {
        return next(err);
    }
});

router.post('/register', async function (req, res, next) {
    try {
        const validUser = jsonschema.validate(req.body, newUserSchema);
        if (!validUser.valid) throw new ExpressError('Bad request', 400);

        const newUser = await User.register(req.body);
        const token = createToken(newUser);
        return res.json({ user: newUser, _token: token });
    } catch (err) {
        return next(err);
    }
});

router.get('/test', async function (req, res, next) {
    return res.json({ URL: DB_URI });
});

module.exports = router;