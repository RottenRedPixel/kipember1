import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient as createSqliteClient } from '@libsql/client';
import pg from 'pg';

const { Client: PgClient } = pg;

const SCALAR_TYPES = new Set(['String', 'Boolean', 'DateTime', 'Int', 'Float', 'Decimal', 'BigInt', 'Bytes']);

const IMPORT_ORDER = [
  'AccessPass',
  'User',
  'ShortLink',
  'AccessSession',
  'UserSession',
  'AuthChallenge',
  'Friendship',
  'Image',
  'ImageAnalysis',
  'Wiki',
  'KidsStory',
  'SportsMode',
  'StoryCut',
  'ImageAttachment',
  'Contributor',
  'Conversation',
  'Message',
  'Response',
  'ImageTag',
  'ChatSession',
  'ChatMessage',
  'VoiceCall',
  'VoiceCallClip',
  'VoiceCallEvent',
  'KidsStoryPanel',
];

function resolveSqliteUrl() {
  const envUrl = process.env.SQLITE_DATABASE_URL || process.env.LEGACY_SQLITE_DATABASE_URL;
  if (envUrl) {
    return envUrl;
  }

  return 'file:./dev.db';
}

function parseSchema(schemaText) {
  const enums = new Set();
  const models = new Map();
  const lines = schemaText.split(/\r?\n/);
  let currentEnum = null;
  let currentModel = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) {
      continue;
    }

    const enumMatch = line.match(/^enum\s+(\w+)\s*\{$/);
    if (enumMatch) {
      currentEnum = enumMatch[1];
      currentModel = null;
      enums.add(currentEnum);
      continue;
    }

    const modelMatch = line.match(/^model\s+(\w+)\s*\{$/);
    if (modelMatch) {
      currentModel = modelMatch[1];
      currentEnum = null;
      models.set(currentModel, []);
      continue;
    }

    if (line === '}') {
      currentEnum = null;
      currentModel = null;
      continue;
    }

    if (!currentModel || line.startsWith('@@')) {
      continue;
    }

    const fieldMatch = line.match(/^(\w+)\s+([^\s]+)(?:\s+.*)?$/);
    if (!fieldMatch) {
      continue;
    }

    const [, fieldName, rawType] = fieldMatch;
    const typeName = rawType.replace(/[?[\]]/g, '');

    if (SCALAR_TYPES.has(typeName) || enums.has(typeName)) {
      models.get(currentModel).push({
        name: fieldName,
        type: typeName,
        isEnum: enums.has(typeName),
      });
    }
  }

  return models;
}

function normalizeValue(value, type) {
  if (value == null) {
    return null;
  }

  switch (type) {
    case 'Boolean':
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'number') {
        return value !== 0;
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === '1' || normalized === 'true') {
          return true;
        }
        if (normalized === '0' || normalized === 'false') {
          return false;
        }
      }
      return Boolean(value);
    case 'Int':
      return typeof value === 'number' ? Math.trunc(value) : Number.parseInt(String(value), 10);
    case 'Float':
    case 'Decimal':
      return typeof value === 'number' ? value : Number.parseFloat(String(value));
    case 'BigInt':
      return typeof value === 'bigint' ? value.toString() : String(value);
    case 'DateTime':
      return value instanceof Date ? value : new Date(String(value));
    case 'Bytes':
      return Buffer.isBuffer(value) ? value : Buffer.from(value);
    default:
      return String(value);
  }
}

function chunk(values, size) {
  const batches = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

async function tableExists(client, tableName) {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    args: [tableName],
  });

  return result.rows.length > 0;
}

async function fetchTableRows(client, tableName) {
  const result = await client.execute(`SELECT * FROM "${tableName}"`);
  return result.rows.map((row) => ({ ...row }));
}

async function ensureTargetIsEmpty(pgClient) {
  const result = await pgClient.query('SELECT COUNT(*)::int AS count FROM "User"');
  const count = result.rows[0]?.count ?? 0;

  if (count > 0) {
    throw new Error('Target Postgres database is not empty. Use a fresh database for the import.');
  }
}

async function insertRows(pgClient, tableName, fields, rows) {
  if (rows.length === 0) {
    return 0;
  }

  let inserted = 0;
  const columnList = fields.map((field) => `"${field.name}"`);

  for (const batch of chunk(rows, 50)) {
    const values = [];
    const rowPlaceholders = [];

    for (const row of batch) {
      const valuePlaceholders = [];
      for (const field of fields) {
        values.push(normalizeValue(row[field.name], field.type));
        valuePlaceholders.push(`$${values.length}`);
      }
      rowPlaceholders.push(`(${valuePlaceholders.join(', ')})`);
    }

    const sql = `INSERT INTO "${tableName}" (${columnList.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`;
    await pgClient.query(sql, values);
    inserted += batch.length;
  }

  return inserted;
}

async function main() {
  const postgresUrl = process.env.DATABASE_URL;
  if (!postgresUrl) {
    throw new Error('DATABASE_URL must point to the target Postgres database.');
  }

  const sqliteUrl = resolveSqliteUrl();
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const schemaText = await fs.readFile(schemaPath, 'utf8');
  const modelFields = parseSchema(schemaText);

  const sqlite = createSqliteClient({ url: sqliteUrl });
  const postgres = new PgClient({ connectionString: postgresUrl });
  await postgres.connect();

  try {
    await ensureTargetIsEmpty(postgres);
    await postgres.query('BEGIN');

    for (const tableName of IMPORT_ORDER) {
      const exists = await tableExists(sqlite, tableName);
      if (!exists) {
        console.log(`Skipping ${tableName} (not present in SQLite source).`);
        continue;
      }

      const fields = modelFields.get(tableName);
      if (!fields || fields.length === 0) {
        console.log(`Skipping ${tableName} (no scalar fields found in schema).`);
        continue;
      }

      const rows = await fetchTableRows(sqlite, tableName);
      const inserted = await insertRows(postgres, tableName, fields, rows);
      console.log(`${tableName}: imported ${inserted} row${inserted === 1 ? '' : 's'}`);
    }

    await postgres.query('COMMIT');
    console.log('SQLite to Postgres import completed successfully.');
  } catch (error) {
    await postgres.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await postgres.end();
    await sqlite.close();
  }
}

main().catch((error) => {
  console.error('SQLite to Postgres import failed:', error);
  process.exitCode = 1;
});
