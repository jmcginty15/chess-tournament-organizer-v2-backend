DROP TABLE IF EXISTS team_games;
DROP TABLE IF EXISTS team_matches;
DROP TABLE IF EXISTS team_entries;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS team_tournaments;
DROP TABLE IF EXISTS ind_games;
DROP TABLE IF EXISTS ind_entries;
DROP TABLE IF EXISTS ind_tournaments;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  username TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT
);

CREATE TABLE ind_tournaments (
  id SERIAL PRIMARY KEY,
  director TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
  name TEXT UNIQUE,
  time_control TEXT,
  category TEXT,
  min_players INT,
  max_players INT,
  rounds INT,
  round_length INT,
  current_round INT,
  registration_open TIMESTAMPTZ,
  registration_close TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  started INT,
  ended INT
);

CREATE TABLE ind_entries (
  id SERIAL PRIMARY KEY,
  player TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
  tournament INT NOT NULL REFERENCES ind_tournaments ON DELETE CASCADE,
  seed INT,
  rating INT,
  score FLOAT,
  sonneborn_berger_score FLOAT,
  place INT,
  prev_opponents TEXT,
  prev_colors TEXT
);

CREATE TABLE ind_games (
  id SERIAL PRIMARY KEY,
  round INT,
  white INT NOT NULL REFERENCES ind_entries ON DELETE CASCADE,
  black INT NOT NULL REFERENCES ind_entries ON DELETE CASCADE,
  tournament INT NOT NULL REFERENCES ind_tournaments ON DELETE CASCADE,
  result TEXT,
  url TEXT,
  schedule TIMESTAMPTZ
);

CREATE TABLE team_tournaments (
  id SERIAL PRIMARY KEY,
  director TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
  name TEXT UNIQUE,
  time_control TEXT,
  category TEXT,
  min_players INT,
  max_players INT,
  team_size INT,
  rounds INT,
  round_length INT,
  current_round INT,
  registration_open TIMESTAMPTZ,
  registration_close TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  started INT,
  ended INT
);

CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tournament INT NOT NULL REFERENCES team_tournaments ON DELETE CASCADE,
  rating FLOAT,
  seed INT,
  score FLOAT,
  sonneborn_berger_score FLOAT,
  place INT,
  prev_opponents TEXT,
  prev_colors TEXT
);

CREATE TABLE team_entries (
  id SERIAL PRIMARY KEY,
  player TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
  team INT REFERENCES teams ON DELETE CASCADE,
  rating INT
);

CREATE TABLE team_matches (
  id SERIAL PRIMARY KEY,
  round INT,
  team_1 INT NOT NULL REFERENCES teams ON DELETE CASCADE,
  team_2 INT NOT NULL REFERENCES teams ON DELETE CASCADE,
  tournament INT REFERENCES team_tournaments ON DELETE CASCADE,
  result TEXT
);

CREATE TABLE team_games (
  id SERIAL PRIMARY KEY,
  white INT NOT NULL REFERENCES team_entries ON DELETE CASCADE,
  black INT NOT NULL REFERENCES team_entries ON DELETE CASCADE,
  match INT REFERENCES team_matches ON DELETE CASCADE,
  result TEXT,
  url TEXT,
  schedule TIMESTAMPTZ
);
