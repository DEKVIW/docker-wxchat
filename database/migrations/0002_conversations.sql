CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO conversations (id, name, is_default)
VALUES (1, '微信传输助手', 1);

ALTER TABLE messages ADD COLUMN conversation_id INTEGER REFERENCES conversations(id);

UPDATE messages
SET conversation_id = 1
WHERE conversation_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp
ON messages(conversation_id, timestamp DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_updated
ON conversations(updated_at DESC);
