// Execute un fichier de migration SQL sur la base configuree dans .env.
// Usage (depuis last-mile-backend/) : npm run migrate -- database/migrations/009_marketplace_and_tracking.sql
// Les migrations du projet sont ecrites pour etre rejouables sans erreur.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import pool, { getDatabaseConfig } from '../src/config/db.js';

dotenv.config();

const file = process.argv[2];

if (!file) {
  console.error('Usage : npm run migrate -- <fichier.sql>');
  process.exit(1);
}

const sql = readFileSync(resolve(file), 'utf8');
const connection = await mysql.createConnection({ ...getDatabaseConfig(), multipleStatements: true });

try {
  await connection.query(sql);
  console.log(`Migration appliquee : ${file}`);
} catch (error) {
  console.error(`Echec de la migration ${file} : ${error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
  await pool.end();
}
