CREATE DATABASE IF NOT EXISTS pets_db;
USE pets_db;

CREATE TABLE IF NOT EXISTS pets (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  image TEXT,
  description TEXT,
  name VARCHAR(100),
  status ENUM('lost', 'found') NOT NULL,
  location VARCHAR(255) NOT NULL,
  alive BOOLEAN DEFAULT true,
  contact VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  atHome BOOLEAN DEFAULT false,
  createdBy VARCHAR(36) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);