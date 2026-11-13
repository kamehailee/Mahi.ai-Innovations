BEGIN;

CREATE TABLE loi_plots (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE
);

INSERT INTO loi_plots (id, name) VALUES
  ('demo-1', 'Demo Loʻi 1'),
  ('demo-2', 'Demo Loʻi 2'),
  ('demo-3', 'Demo Loʻi 3');

CREATE TABLE observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plot_id text NOT NULL REFERENCES loi_plots (id),
  observed_on date NOT NULL,
  adult_count integer CHECK (adult_count >= 0),
  egg_mass_count integer CHECK (egg_mass_count >= 0),
  survey_minutes integer NOT NULL CHECK (survey_minutes > 0),
  notes text NOT NULL CHECK (char_length(notes) <= 2000)
);

COMMENT ON COLUMN observations.adult_count IS 'NULL means not surveyed; zero means surveyed and none found.';
COMMENT ON COLUMN observations.egg_mass_count IS 'NULL means not surveyed; zero means surveyed and none found.';

COMMIT;
