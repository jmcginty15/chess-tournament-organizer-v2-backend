const generateGames = (team1, team2) => {
    /** Creates games for a team match */
    const games = [];
    for (let i = 0; i < team1.members.length; i++) {
        if (i % 4 === 0 || (i + 1) % 4 === 0) games.push({ white: team1.members[i], black: team2.members[i] });
        else games.push({ white: team2.members[i], black: team1.members[i] });
    }
    return games;
}

module.exports = { generateGames };