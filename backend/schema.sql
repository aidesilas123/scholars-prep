-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  active_session BOOLEAN DEFAULT FALSE
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('exam', 'test')) NOT NULL
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  year INT CHECK (year BETWEEN 2018 AND 2025),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,   -- Example: { "A": "2x+3", "B": "x-1" }
  answer VARCHAR(5) NOT NULL
);
