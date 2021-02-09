/** Server for chess tournament organizer. */

const { PORT } = require('./config');
const app = require('./app');

app.listen(PORT, () => {
    console.log(`Server starting on port ${PORT}`);
});
