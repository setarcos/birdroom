CREATE TABLE temperature (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL CHECK (room_id BETWEEN 1 AND 26),
    temperature REAL NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recorded_at ON temperature (recorded_at);
