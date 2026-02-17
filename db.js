const { Pool } = require('pg')

let pool = null
const url = process.env.DATABASE_URL

if (url) {
  const ssl = process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  pool = new Pool({ connectionString: url, ssl })
}

async function query(text, params) {
  if (!pool) {
    return { rows: [], rowCount: 0 }
  }
  const res = await pool.query(text, params)
  return res
}

function available() {
  return !!pool
}

module.exports = { query, available }
