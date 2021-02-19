UPDATE team_games SET result = '1-0' WHERE id = 1;
UPDATE team_games SET result = '0.5-0.5' WHERE id = 2;
UPDATE team_games SET result = '0.5-0.5' WHERE id = 3;
UPDATE team_games SET result = '0-1' WHERE id = 4;
UPDATE team_games SET result = '0-1' WHERE id = 5;
UPDATE team_games SET result = '0-1' WHERE id = 6;
UPDATE team_games SET result = '0.5-0.5' WHERE id = 7;
UPDATE team_games SET result = '1-0' WHERE id = 8;

UPDATE team_matches SET result = '2-2' WHERE id = 1;
UPDATE team_matches SET result = '2.5-1.5' WHERE id = 2;

UPDATE teams SET score = 2 WHERE id = 3;
UPDATE teams SET score = 2 WHERE id = 4;
UPDATE teams SET score = 2.5 WHERE id = 6;
UPDATE teams SET score = 1.5 WHERE id = 2;
