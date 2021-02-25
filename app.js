/** Express app for chess tournament organizer. */


const express = require('express');
const cors = require('cors');
const { authenticateJWT } = require('./middleware/auth');
const app = express();

app.use(cors({ origin: '*' }));

app.use(express.json());
// app.use(function (req, res, next) {
//     res.header('Access-Control-Allow-Origin', 'https://flexchess.surge.sh');
//     res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
//     next();
// });
app.use(authenticateJWT);

const ExpressError = require('./expressError');
const authRoutes = require('./routes/auth');
const entryRoutes = require('./routes/entries');
const gameRoutes = require('./routes/games');
const matchRoutes = require('./routes/matches');
const teamRoutes = require('./routes/teams');
const tournamentRoutes = require('./routes/tournaments');
const userRoutes = require('./routes/users');

app.use('/auth', authRoutes);
app.use('/entries', entryRoutes);
app.use('/games', gameRoutes);
app.use('/matches', matchRoutes);
app.use('/teams', teamRoutes);
app.use('/tournaments', tournamentRoutes);
app.use('/users', userRoutes);

/** 404 handler */

app.use(function (req, res, next) {
    const err = new ExpressError('Not Found', 404);
    return next(err);
});


/** general error handler */

app.use(function (err, req, res, next) {
    res.status(err.status || 500);

    return res.json({
        error: err,
        message: err.message
    });
});


module.exports = app;
