import { createServer } from 'node:http'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const serverDirectory = fileURLToPath(new URL('.', import.meta.url))
const databasePath = process.env.LEADFLOW_DB_PATH ?? join(serverDirectory, 'data', 'leadflow.sqlite')
if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })
const documentsDirectory = process.env.LEADFLOW_DOCUMENTS_PATH ?? join(dirname(databasePath), 'documents')
mkdirSync(documentsDirectory, { recursive: true })
const database = new DatabaseSync(databasePath)
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT 'Call Executive',
    daily_target INTEGER NOT NULL DEFAULT 100,
    calls_completed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Online'
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Staff')),
    employee_id INTEGER REFERENCES employees(id)
  );
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    loan TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New',
    assigned_employee_id INTEGER REFERENCES employees(id),
    follow_up_at TEXT,
    source TEXT NOT NULL DEFAULT 'Manual',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    outcome TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS banks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    loan_types TEXT NOT NULL,
    scheme_count INTEGER NOT NULL DEFAULT 0,
    brand_color TEXT NOT NULL DEFAULT '#665af2',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    bank_id INTEGER NOT NULL REFERENCES banks(id),
    scheme TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Under Review',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    document_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT
  );
`)

const employeeNames = [
  'Priya Sharma', 'Arjun Mehta', 'Sneha Patel', 'Rahul Verma', 'Neha Kapoor',
  'Aarav Shah', 'Ananya Iyer', 'Vikram Rao', 'Kavya Nair', 'Rohan Gupta',
  'Meera Joshi', 'Ishaan Das', 'Pooja Menon', 'Aditya Reddy', 'Simran Kaur',
  'Kabir Malhotra', 'Divya Pillai', 'Karan Sethi', 'Nisha Kulkarni', 'Amit Bansal',
]
const employeeSeed = database.prepare(
  'INSERT OR IGNORE INTO employees (name, email, calls_completed, status) VALUES (?, ?, ?, ?)',
)
employeeNames.forEach((name, index) => {
  employeeSeed.run(name, `${name.toLowerCase().replaceAll(' ', '.')}@leadflow.com`, [92, 86, 74, 68][index] ?? 0, index === 3 ? 'Offline' : 'Online')
})

const employees = database.prepare('SELECT id, name FROM employees')
const employeeByName = new Map(employees.all().map(employee => [employee.name, employee.id]))
const today = new Date()
const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(today)
const tomorrow = new Date(`${localDate}T00:00:00+05:30`)
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(tomorrow)
const leadSeed = [
  ['Rajesh Kumar', '+91 98765 43210', 'Home Loan', '₹35,00,000', 'Interested', 'Priya Sharma', `${localDate}T11:30:00+05:30`, 'Website'],
  ['Anita Desai', '+91 98220 11842', 'Personal Loan', '₹8,50,000', 'Follow-up', 'Arjun Mehta', `${localDate}T14:00:00+05:30`, 'Referral'],
  ['Vikram Singh', '+91 99887 66554', 'Business Loan', '₹12,00,000', 'Documents', 'Priya Sharma', `${tomorrowDate}T10:00:00+05:30`, 'Campaign'],
  ['Meera Nair', '+91 98450 11223', 'Car Loan', '₹6,25,000', 'Not Interested', 'Sneha Patel', null, 'Walk-in'],
  ['Karan Malhotra', '+91 97654 32109', 'Home Loan', '₹48,00,000', 'New', null, `${localDate}T16:30:00+05:30`, 'Website'],
  ['Sunita Rao', '+91 98112 33445', 'Education Loan', '₹15,00,000', 'Approved', 'Priya Sharma', null, 'Referral'],
]
const leadCount = database.prepare('SELECT COUNT(*) AS count FROM leads').get().count
if (leadCount === 0) {
  const insertLead = database.prepare(`
    INSERT INTO leads (name, phone, loan, amount, status, assigned_employee_id, follow_up_at, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const [name, phone, loan, amount, status, assigned, followUpAt, source] of leadSeed) {
    insertLead.run(name, phone, loan, amount, status, assigned ? employeeByName.get(assigned) : null, followUpAt, source)
  }
}

const bankSeed = [
  ['HDFC Bank', 'Home, Personal, Car', 48, '#665af2'],
  ['ICICI Bank', 'Home, Education', 36, '#ee9a43'],
  ['Axis Bank', 'Business, Personal', 29, '#e23e57'],
  ['SBI', 'Home, Education, Car', 52, '#21a67a'],
]
const insertBank = database.prepare('INSERT OR IGNORE INTO banks (name, loan_types, scheme_count, brand_color) VALUES (?, ?, ?, ?)')
for (const bank of bankSeed) insertBank.run(...bank)

if (database.prepare('SELECT COUNT(*) AS count FROM applications').get().count === 0) {
  const applicationSeed = [
    [1, 'HDFC Bank', 'Home Loan', '₹35,00,000', 'Under Review'],
    [6, 'ICICI Bank', 'Education Loan', '₹15,00,000', 'Approved'],
    [3, 'Axis Bank', 'Business Loan', '₹12,00,000', 'Documents'],
  ]
  const insertApplication = database.prepare(`
    INSERT INTO applications (reference, lead_id, bank_id, scheme, amount, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const [leadId, bankName, scheme, amount, status] of applicationSeed) {
    const bankId = database.prepare('SELECT id FROM banks WHERE name = ?').get(bankName)?.id
    if (bankId && database.prepare('SELECT 1 FROM leads WHERE id = ?').get(leadId)) {
      insertApplication.run(`APP-${String(leadId).padStart(4, '0')}`, leadId, bankId, scheme, amount, status)
    }
  }
}

function seedUser(email, password, role, employeeId = null) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  database.prepare(`
    INSERT OR IGNORE INTO users (email, password_salt, password_hash, role, employee_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(email.toLowerCase(), salt, hash, role, employeeId)
}

seedUser('admin@leadflow.com', 'password', 'Admin')
seedUser('priya@leadflow.com', 'password', 'Staff', employeeByName.get('Priya Sharma'))

const sessions = new Map()
const sessionLifetime = 8 * 60 * 60 * 1000
const leadSelect = `
  SELECT l.id, printf('LD-%03d', l.id) AS public_id, l.name, l.phone, l.loan, l.amount,
    l.status, l.follow_up_at, l.source, l.notes, l.created_at, l.updated_at,
    e.id AS assigned_employee_id, e.name AS assigned
  FROM leads l LEFT JOIN employees e ON e.id = l.assigned_employee_id
`
const leadList = database.prepare(`${leadSelect} ORDER BY l.id DESC`)
const leadById = database.prepare(`${leadSelect} WHERE l.id = ?`)
const employeeList = database.prepare(`
  SELECT e.id, e.name, e.email, e.title, e.daily_target AS target, e.calls_completed AS calls,
    e.status, (SELECT COUNT(*) FROM leads l WHERE l.assigned_employee_id = e.id) AS assigned_leads
  FROM employees e ORDER BY e.id
`)

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  response.end(JSON.stringify(value))
}

function cookieValue(request, name) {
  const cookie = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null
}

function currentSession(request) {
  const sessionId = cookieValue(request, 'lf_session')
  const session = sessionId ? sessions.get(sessionId) : null
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId)
    return null
  }
  session.expiresAt = Date.now() + sessionLifetime
  return session
}

function readJson(request) {
  return new Promise((resolveBody, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', chunk => {
      body += chunk
      if (body.length > 6 * 1024 * 1024) {
        reject(new HttpError(413, 'Request body is too large.'))
        request.destroy()
      }
    })
    request.on('end', () => {
      if (!body) return resolveBody({})
      try {
        resolveBody(JSON.parse(body))
      } catch {
        reject(new HttpError(400, 'Request body must be valid JSON.'))
      }
    })
    request.on('error', reject)
  })
}

function publicEmployee(employee) {
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    employeeId: employee.employee_id,
  }
}

function getLeadId(pathId) {
  const match = /^LD-(\d+)$/.exec(pathId)
  if (!match) throw new HttpError(400, 'Lead ID is invalid.')
  return Number(match[1])
}

function requireAdmin(user) {
  if (user.role !== 'Admin') throw new HttpError(403, 'Only an admin can perform this action.')
}

function leadIsVisibleTo(user, leadId) {
  if (user.role === 'Admin') return true
  return Boolean(database.prepare('SELECT 1 FROM leads WHERE id = ? AND assigned_employee_id = ?').get(leadId, user.employeeId))
}

async function handleApi(request, response, url) {
  const method = request.method
  const path = url.pathname

  if (path === '/api/health' && method === 'GET') {
    return sendJson(response, 200, { ok: true, database: 'sqlite' })
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const body = await readJson(request)
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const record = database.prepare(`
      SELECT u.id, u.email, u.password_salt, u.password_hash, u.role, u.employee_id, e.name AS employee_name
      FROM users u LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.email = ?
    `).get(email)
    if (!record || password.length > 1024) throw new HttpError(401, 'Email or password is incorrect.')
    const expected = Buffer.from(record.password_hash, 'hex')
    const actual = scryptSync(password, record.password_salt, expected.length)
    if (!timingSafeEqual(expected, actual)) throw new HttpError(401, 'Email or password is incorrect.')

    const sessionId = randomBytes(32).toString('hex')
    const user = { userId: record.id, email: record.email, role: record.role, employeeId: record.employee_id, name: record.employee_name ?? 'Amit Kumar' }
    sessions.set(sessionId, { ...user, expiresAt: Date.now() + sessionLifetime })
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    return sendJson(response, 200, { user }, {
      'Set-Cookie': `lf_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`,
    })
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const sessionId = cookieValue(request, 'lf_session')
    if (sessionId) sessions.delete(sessionId)
    return sendJson(response, 200, { ok: true }, {
      'Set-Cookie': 'lf_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
    })
  }

  const user = currentSession(request)
  if (path === '/api/auth/me' && method === 'GET') {
    return sendJson(response, 200, { user })
  }
  if (!user) throw new HttpError(401, 'Sign in to continue.')

  if (path === '/api/leads' && method === 'GET') {
    const rows = user.role === 'Admin'
      ? leadList.all()
      : database.prepare(`${leadSelect} WHERE l.assigned_employee_id = ? ORDER BY l.id DESC`).all(user.employeeId)
    return sendJson(response, 200, { leads: rows.map(row => ({
      id: row.public_id,
      name: row.name,
      phone: row.phone,
      loan: row.loan,
      amount: row.amount,
      status: row.status,
      assigned: row.assigned ?? 'Unassigned',
      assignedEmployeeId: row.assigned_employee_id,
      follow: row.follow_up_at,
      followUpAt: row.follow_up_at,
      source: row.source,
      notes: row.notes,
      createdAt: row.created_at,
    })) })
  }

  if (path === '/api/leads' && method === 'POST') {
    const body = await readJson(request)
    const name = String(body.name ?? '').trim()
    const phone = String(body.phone ?? '').trim()
    const loan = String(body.loan ?? '').trim()
    const amount = String(body.amount ?? '').trim()
    if (!name || !phone || !loan || !amount) throw new HttpError(400, 'Name, phone, loan type, and amount are required.')
    if (name.length > 120 || phone.length > 40 || loan.length > 80 || amount.length > 40) {
      throw new HttpError(400, 'One or more lead fields are too long.')
    }
    const result = database.prepare(`
      INSERT INTO leads (name, phone, loan, amount, status, source, notes)
      VALUES (?, ?, ?, ?, 'New', ?, ?)
    `).run(name, phone, loan, amount, String(body.source ?? 'Manual').slice(0, 80), String(body.notes ?? '').slice(0, 2000))
    const id = `LD-${String(result.lastInsertRowid).padStart(3, '0')}`
    return sendJson(response, 201, { lead: {
      id, name, phone, loan, amount, status: 'New', assigned: 'Unassigned',
      assignedEmployeeId: null, follow: null, followUpAt: null, source: body.source ?? 'Manual',
    } })
  }

  if (path === '/api/leads/import' && method === 'POST') {
    requireAdmin(user)
    const body = await readJson(request)
    if (!Array.isArray(body.leads) || body.leads.length === 0 || body.leads.length > 500) {
      throw new HttpError(400, 'Upload a CSV with between 1 and 500 leads.')
    }
    const normalized = body.leads.map((lead, index) => {
      const name = String(lead.name ?? '').trim()
      const phone = String(lead.phone ?? '').trim()
      const loan = String(lead.loan ?? '').trim()
      const amount = String(lead.amount ?? '').trim()
      if (!name || !phone || !loan || !amount) throw new HttpError(400, `CSV row ${index + 2} is missing a required field.`)
      if (name.length > 120 || phone.length > 40 || loan.length > 80 || amount.length > 40) {
        throw new HttpError(400, `CSV row ${index + 2} has a field that is too long.`)
      }
      return [name, phone, loan, amount, String(lead.source ?? 'CSV import').slice(0, 80), String(lead.notes ?? '').slice(0, 2000)]
    })
    database.exec('BEGIN IMMEDIATE')
    try {
      const insert = database.prepare(`
        INSERT INTO leads (name, phone, loan, amount, status, source, notes)
        VALUES (?, ?, ?, ?, 'New', ?, ?)
      `)
      for (const record of normalized) insert.run(...record)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
    return sendJson(response, 201, { importedCount: normalized.length })
  }

  if (path === '/api/leads/assign' && method === 'POST') {
    requireAdmin(user)
    const body = await readJson(request)
    const employeeId = Number(body.employeeId)
    if (!Number.isInteger(employeeId) || !database.prepare('SELECT 1 FROM employees WHERE id = ?').get(employeeId)) {
      throw new HttpError(400, 'Select a valid employee.')
    }
    const result = database.prepare(`
      UPDATE leads SET assigned_employee_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE status = 'New' AND assigned_employee_id IS NULL
    `).run(employeeId)
    return sendJson(response, 200, { assignedCount: Number(result.changes) })
  }

  const leadRoute = /^\/api\/leads\/([^/]+)(?:\/(calls|follow-ups))?$/.exec(path)
  if (leadRoute) {
    const leadId = getLeadId(leadRoute[1])
    const lead = leadById.get(leadId)
    if (!lead) throw new HttpError(404, 'Lead was not found.')
    if (!leadIsVisibleTo(user, leadId)) throw new HttpError(403, 'You can only access leads assigned to you.')

    if (leadRoute[2] === 'calls' && method === 'POST') {
      const body = await readJson(request)
      const outcome = String(body.outcome ?? '').trim()
      if (!outcome || outcome.length > 80) throw new HttpError(400, 'Select a valid call outcome.')
      const employeeId = user.employeeId ?? lead.assigned_employee_id
      if (!employeeId) throw new HttpError(400, 'Assign this lead to an employee before logging a call.')
      database.prepare('INSERT INTO calls (lead_id, employee_id, outcome, notes) VALUES (?, ?, ?, ?)')
        .run(leadId, employeeId, outcome, String(body.notes ?? '').slice(0, 2000))
      database.prepare('UPDATE employees SET calls_completed = calls_completed + 1 WHERE id = ?').run(employeeId)
      if (['Interested', 'Not Interested', 'Follow-up'].includes(outcome)) {
        database.prepare('UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(outcome, leadId)
      }
      return sendJson(response, 201, { ok: true })
    }

    if (leadRoute[2] === 'follow-ups' && method === 'POST') {
      const body = await readJson(request)
      const followUpAt = String(body.followUpAt ?? '')
      if (!Number.isFinite(Date.parse(followUpAt))) throw new HttpError(400, 'Enter a valid follow-up date and time.')
      database.prepare('UPDATE leads SET follow_up_at = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(new Date(followUpAt).toISOString(), 'Follow-up', leadId)
      return sendJson(response, 200, { ok: true })
    }

    if (method === 'PATCH' && !leadRoute[2]) {
      const body = await readJson(request)
      const allowedStatuses = ['New', 'Interested', 'Follow-up', 'Documents', 'Approved', 'Not Interested']
      if (body.status !== undefined && !allowedStatuses.includes(body.status)) {
        throw new HttpError(400, 'Select a valid lead status.')
      }
      const updateFields = []
      const values = []
      if (body.status !== undefined) {
        updateFields.push('status = ?')
        values.push(body.status)
      }
      if (body.assignedEmployeeId !== undefined) {
        requireAdmin(user)
        const employeeId = body.assignedEmployeeId === null ? null : Number(body.assignedEmployeeId)
        if (employeeId !== null && (!Number.isInteger(employeeId) || !database.prepare('SELECT 1 FROM employees WHERE id = ?').get(employeeId))) {
          throw new HttpError(400, 'Select a valid employee.')
        }
        updateFields.push('assigned_employee_id = ?')
        values.push(employeeId)
      }
      if (body.followUpAt !== undefined) {
        const followUpAt = body.followUpAt === null ? null : String(body.followUpAt)
        if (followUpAt && !Number.isFinite(Date.parse(followUpAt))) throw new HttpError(400, 'Enter a valid follow-up date and time.')
        updateFields.push('follow_up_at = ?')
        values.push(followUpAt ? new Date(followUpAt).toISOString() : null)
      }
      if (body.notes !== undefined) {
        updateFields.push('notes = ?')
        values.push(String(body.notes).slice(0, 2000))
      }
      if (updateFields.length === 0) throw new HttpError(400, 'Provide at least one field to update.')
      values.push(leadId)
      database.prepare(`UPDATE leads SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values)
      return sendJson(response, 200, { lead: leadById.get(leadId) })
    }
  }

  if (path === '/api/employees' && method === 'GET') {
    const records = user.role === 'Admin'
      ? employeeList.all()
      : employeeList.all().filter(employee => employee.id === user.employeeId)
    return sendJson(response, 200, { employees: records })
  }

  if (path === '/api/employees' && method === 'POST') {
    requireAdmin(user)
    const body = await readJson(request)
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    if (!name || name.length > 120) throw new HttpError(400, 'Enter an employee name (up to 120 characters).')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid employee email address.')
    if (password.length < 8 || password.length > 1024) throw new HttpError(400, 'The temporary password must be at least 8 characters.')
    if (database.prepare('SELECT 1 FROM employees WHERE lower(email) = ? OR lower(name) = ?').get(email, name.toLowerCase())) {
      throw new HttpError(409, 'An employee with that name or email already exists.')
    }
    const salt = randomBytes(16).toString('hex')
    const passwordHash = scryptSync(password, salt, 64).toString('hex')
    database.exec('BEGIN IMMEDIATE')
    let employeeId
    try {
      const result = database.prepare('INSERT INTO employees (name, email) VALUES (?, ?)').run(name, email)
      employeeId = Number(result.lastInsertRowid)
      database.prepare(`
        INSERT INTO users (email, password_salt, password_hash, role, employee_id)
        VALUES (?, ?, ?, 'Staff', ?)
      `).run(email, salt, passwordHash, employeeId)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
    return sendJson(response, 201, { employee: {
      id: employeeId, name, email, title: 'Call Executive', target: 100, calls: 0,
      status: 'Online', assigned_leads: 0,
    } })
  }

  if (path === '/api/banks' && method === 'GET') {
    const banks = database.prepare('SELECT id, name, loan_types AS loanTypes, scheme_count AS schemeCount, brand_color AS color FROM banks ORDER BY name').all()
    return sendJson(response, 200, { banks })
  }

  if (path === '/api/banks' && method === 'POST') {
    requireAdmin(user)
    const body = await readJson(request)
    const name = String(body.name ?? '').trim()
    const loanTypes = String(body.loanTypes ?? '').trim()
    const schemeCount = Number(body.schemeCount)
    const color = String(body.color ?? '#665af2')
    if (!name || name.length > 120 || !loanTypes || loanTypes.length > 300) {
      throw new HttpError(400, 'Enter a bank name and its supported loan types.')
    }
    if (!Number.isInteger(schemeCount) || schemeCount < 0 || schemeCount > 10000) {
      throw new HttpError(400, 'Scheme count must be between 0 and 10,000.')
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new HttpError(400, 'Enter a valid six-digit brand color.')
    if (database.prepare('SELECT 1 FROM banks WHERE lower(name) = ?').get(name.toLowerCase())) {
      throw new HttpError(409, 'That bank is already listed.')
    }
    const result = database.prepare('INSERT INTO banks (name, loan_types, scheme_count, brand_color) VALUES (?, ?, ?, ?)')
      .run(name, loanTypes, schemeCount, color)
    return sendJson(response, 201, { bank: { id: Number(result.lastInsertRowid), name, loanTypes, schemeCount, color } })
  }

  if (path === '/api/applications' && method === 'GET') {
    const rows = user.role === 'Admin'
      ? database.prepare(`
        SELECT a.id, a.reference, a.lead_id, printf('LD-%03d', a.lead_id) AS lead_public_id,
          l.name AS customer, b.name AS bank, a.scheme, a.amount, a.status, a.created_at
        FROM applications a JOIN leads l ON l.id = a.lead_id JOIN banks b ON b.id = a.bank_id
        ORDER BY a.created_at DESC, a.id DESC
      `).all()
      : database.prepare(`
        SELECT a.id, a.reference, a.lead_id, printf('LD-%03d', a.lead_id) AS lead_public_id,
          l.name AS customer, b.name AS bank, a.scheme, a.amount, a.status, a.created_at
        FROM applications a JOIN leads l ON l.id = a.lead_id JOIN banks b ON b.id = a.bank_id
        WHERE l.assigned_employee_id = ? ORDER BY a.created_at DESC, a.id DESC
      `).all(user.employeeId)
    return sendJson(response, 200, { applications: rows.map(row => ({
      id: row.reference,
      leadId: row.lead_public_id,
      customer: row.customer,
      bank: row.bank,
      scheme: row.scheme,
      amount: row.amount,
      status: row.status,
      createdAt: row.created_at,
    })) })
  }

  if (path === '/api/applications' && method === 'POST') {
    const body = await readJson(request)
    const leadId = getLeadId(String(body.leadId ?? ''))
    const lead = leadById.get(leadId)
    if (!lead) throw new HttpError(404, 'Lead was not found.')
    if (!leadIsVisibleTo(user, leadId)) throw new HttpError(403, 'You can only create an application for your assigned leads.')
    const bankId = Number(body.bankId)
    const bank = database.prepare('SELECT id, name FROM banks WHERE id = ?').get(bankId)
    if (!bank) throw new HttpError(400, 'Select a valid bank.')
    const scheme = String(body.scheme ?? '').trim()
    const amount = String(body.amount ?? '').trim()
    if (!scheme || scheme.length > 120 || !amount || amount.length > 40) {
      throw new HttpError(400, 'Enter a loan scheme and amount.')
    }
    const reference = `APP-${randomUUID().slice(0, 8).toUpperCase()}`
    database.prepare(`
      INSERT INTO applications (reference, lead_id, bank_id, scheme, amount, status)
      VALUES (?, ?, ?, ?, ?, 'Under Review')
    `).run(reference, leadId, bankId, scheme, amount)
    return sendJson(response, 201, { application: {
      id: reference, leadId: `LD-${String(leadId).padStart(3, '0')}`,
      customer: lead.name, bank: bank.name, scheme, amount, status: 'Under Review',
    } })
  }

  const applicationRoute = /^\/api\/applications\/(APP-[A-Z0-9-]+)$/.exec(path)
  if (applicationRoute && method === 'PATCH') {
    const statuses = ['Under Review', 'Documents', 'Approved', 'Rejected', 'Disbursed', 'Closed']
    const status = String((await readJson(request)).status ?? '')
    if (!statuses.includes(status)) throw new HttpError(400, 'Select a valid application status.')
    const application = database.prepare(`
      SELECT a.id, a.lead_id FROM applications a WHERE a.reference = ?
    `).get(applicationRoute[1])
    if (!application) throw new HttpError(404, 'Application was not found.')
    if (!leadIsVisibleTo(user, application.lead_id)) throw new HttpError(403, 'You can only update applications for your assigned leads.')
    database.prepare('UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, application.id)
    if (status === 'Approved') {
      database.prepare('UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('Approved', application.lead_id)
    }
    return sendJson(response, 200, { ok: true })
  }

  if (path === '/api/documents' && method === 'GET') {
    const rows = user.role === 'Admin'
      ? database.prepare(`
        SELECT d.id, printf('LD-%03d', d.lead_id) AS lead_id, l.name AS customer,
          d.document_type, d.original_name, d.mime_type, d.size_bytes, d.status, d.uploaded_at
        FROM documents d JOIN leads l ON l.id = d.lead_id ORDER BY d.uploaded_at DESC, d.id DESC
      `).all()
      : database.prepare(`
        SELECT d.id, printf('LD-%03d', d.lead_id) AS lead_id, l.name AS customer,
          d.document_type, d.original_name, d.mime_type, d.size_bytes, d.status, d.uploaded_at
        FROM documents d JOIN leads l ON l.id = d.lead_id
        WHERE l.assigned_employee_id = ? ORDER BY d.uploaded_at DESC, d.id DESC
      `).all(user.employeeId)
    return sendJson(response, 200, { documents: rows.map(row => ({
      id: row.id,
      leadId: row.lead_id,
      customer: row.customer,
      documentType: row.document_type,
      fileName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      status: row.status,
      uploadedAt: row.uploaded_at,
    })) })
  }

  if (path === '/api/documents' && method === 'POST') {
    const body = await readJson(request)
    const leadId = getLeadId(String(body.leadId ?? ''))
    const lead = leadById.get(leadId)
    if (!lead) throw new HttpError(404, 'Lead was not found.')
    if (!leadIsVisibleTo(user, leadId)) throw new HttpError(403, 'You can only upload documents for your assigned leads.')
    const documentTypes = ['PAN Card', 'Identity Proof', 'Address Proof', 'Salary Slips', 'Bank Statement', 'Other']
    const documentType = String(body.documentType ?? '')
    if (!documentTypes.includes(documentType)) throw new HttpError(400, 'Select a valid document type.')
    const originalName = basename(String(body.fileName ?? '')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200)
    const mimeType = String(body.mimeType ?? '')
    const mimeExtensions = { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] }
    if (!originalName || !mimeExtensions[mimeType]?.includes(extname(originalName).toLowerCase())) {
      throw new HttpError(400, 'Upload a PDF, JPG, or PNG file.')
    }
    const encoded = String(body.contentBase64 ?? '')
    if (!encoded || encoded.length > 6 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
      throw new HttpError(400, 'The document must be valid base64 and no larger than 4 MB.')
    }
    const fileContent = Buffer.from(encoded, 'base64')
    if (!fileContent.length || fileContent.length > 4 * 1024 * 1024 || fileContent.toString('base64') !== encoded) {
      throw new HttpError(400, 'The document must be valid base64 and no larger than 4 MB.')
    }
    const signatures = {
      'application/pdf': fileContent.subarray(0, 5).toString() === '%PDF-',
      'image/jpeg': fileContent[0] === 0xff && fileContent[1] === 0xd8 && fileContent[2] === 0xff,
      'image/png': fileContent.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    }
    if (!signatures[mimeType]) throw new HttpError(400, 'The file content does not match its file type.')

    const storedName = `${randomUUID()}${extname(originalName).toLowerCase()}`
    const storagePath = join(documentsDirectory, storedName)
    let fileWritten = false
    try {
      writeFileSync(storagePath, fileContent, { flag: 'wx' })
      fileWritten = true
      const result = database.prepare(`
        INSERT INTO documents (lead_id, document_type, original_name, stored_name, mime_type, size_bytes, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(leadId, documentType, originalName, storedName, mimeType, fileContent.length, user.userId)
      const uploadedAt = database.prepare('SELECT uploaded_at FROM documents WHERE id = ?')
        .get(result.lastInsertRowid).uploaded_at
      return sendJson(response, 201, { document: {
        id: Number(result.lastInsertRowid), leadId: `LD-${String(leadId).padStart(3, '0')}`,
        customer: lead.name, documentType, fileName: originalName, mimeType, uploadedAt,
        sizeBytes: fileContent.length, status: 'Pending',
      } })
    } catch (error) {
      if (fileWritten) unlinkSync(storagePath)
      throw error
    }
  }

  const documentRoute = /^\/api\/documents\/(\d+)(?:\/download)?$/.exec(path)
  if (documentRoute) {
    const document = database.prepare(`
      SELECT d.id, d.lead_id, d.original_name, d.stored_name, d.mime_type, d.status
      FROM documents d WHERE d.id = ?
    `).get(Number(documentRoute[1]))
    if (!document) throw new HttpError(404, 'Document was not found.')
    if (!leadIsVisibleTo(user, document.lead_id)) throw new HttpError(403, 'You can only access documents for your assigned leads.')
    if (path.endsWith('/download') && method === 'GET') {
      const content = readFileSync(join(documentsDirectory, document.stored_name))
      return response.writeHead(200, {
        'Content-Type': document.mime_type,
        'Content-Length': content.length,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.original_name)}`,
        'X-Content-Type-Options': 'nosniff',
      }).end(content)
    }
    if (method === 'PATCH') {
      requireAdmin(user)
      const status = String((await readJson(request)).status ?? '')
      if (!['Verified', 'Rejected'].includes(status)) throw new HttpError(400, 'Document status must be Verified or Rejected.')
      database.prepare('UPDATE documents SET status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, document.id)
      return sendJson(response, 200, { ok: true })
    }
  }

  if (path === '/api/follow-ups' && method === 'GET') {
    const rows = user.role === 'Admin'
      ? database.prepare(`${leadSelect} WHERE l.follow_up_at IS NOT NULL ORDER BY l.follow_up_at`).all()
      : database.prepare(`${leadSelect} WHERE l.follow_up_at IS NOT NULL AND l.assigned_employee_id = ? ORDER BY l.follow_up_at`).all(user.employeeId)
    return sendJson(response, 200, { followUps: rows.map(row => ({
      id: row.public_id,
      name: row.name,
      loan: row.loan,
      assigned: row.assigned ?? 'Unassigned',
      followUpAt: row.follow_up_at,
    })) })
  }

  throw new HttpError(404, 'API endpoint was not found.')
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function serveStatic(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  const root = resolve(serverDirectory, '..', 'dist')
  let filePath = resolve(root, `.${decodeURIComponent(pathname)}`)
  const relativePath = relative(root, filePath)
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..') {
    throw new HttpError(403, 'Invalid file path.')
  }
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) return false
  if (!statSync(filePath, { throwIfNoEntry: false })?.isFile()) filePath = join(root, 'index.html')
  const content = readFileSync(filePath)
  response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream' })
  response.end(request.method === 'HEAD' ? undefined : content)
  return true
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const operation = url.pathname.startsWith('/api/')
    ? handleApi(request, response, url)
    : process.env.API_ONLY === '1'
      ? Promise.reject(new HttpError(404, 'Not found.'))
      : Promise.resolve().then(() => {
        if (!serveStatic(request, response, url.pathname)) throw new HttpError(404, 'Built app not found. Run npm run build first.')
      })

  operation.catch(error => {
    if (response.headersSent || response.destroyed) return
    const status = error instanceof HttpError ? error.status : 500
    if (status === 500) console.error(error)
    sendJson(response, status, { error: status === 500 ? 'Unexpected server error.' : error.message })
  })
})

const port = Number(process.env.PORT ?? 5173)
server.listen(port, '127.0.0.1', () => {
  console.log(`LeadFlow ${process.env.API_ONLY === '1' ? 'API' : 'app'} listening on http://127.0.0.1:${port}`)
})
