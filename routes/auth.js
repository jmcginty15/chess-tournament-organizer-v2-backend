const express = require('express');
const User = require('../models/user');
const jsonschema = require('jsonschema');
const newUserSchema = require('../schemas/userNew.json');
const { createToken } = require('../helpers/auth');

const ExpressError = require('../expressError');

const router = new express.Router();

/** POST /login
 * { username, password } => { username, email, firstName, lastName, _token }
 */

router.post('/login', async function (req, res, next) {
    try {
        const user = await User.login(req.body.username, req.body.password);
        const token = createToken(user);
        return res.json({ user: user, _token: token });
    } catch (err) {
        return next(err);
    }
});

/** POST /register
 * { username, password, email, firstName, lastName } => { username, email, firstName, lastName, _token }
 */

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

module.exports = router;