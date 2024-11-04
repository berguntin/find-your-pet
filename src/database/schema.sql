CREATE DATABASE IF NOT EXISTS pets_db;
USE pets_db;

CREATE TABLE IF NOT EXISTS pets (
  id BINARY(16) PRIMARY KEY,
  type ENUM('Perro', 'Gato', 'Otro') NOT NULL,
  images TEXT,
  description TEXT,
  name VARCHAR(100),
  status ENUM('lost', 'found') NOT NULL,
  location VARCHAR(255) NOT NULL,
  alive BOOLEAN DEFAULT true,
  contact VARCHAR(250) NOT NULL,
  date DATE NOT NULL,
  atHome BOOLEAN DEFAULT false,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BINARY(16) PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(200),
  phone VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)