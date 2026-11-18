import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { parseLeadCsv } from './csv.js'
import {
  LayoutDashboard, Users, UserRoundCheck, CalendarClock, FileCheck2,
  Landmark, ChartNoAxesCombined, LogOut, Search, Bell, ChevronDown, Plus,
  Upload, MoreHorizontal, Phone, CheckCircle2, ArrowUpRight, X,
  Menu, PhoneCall, ClipboardCheck, Settings, Download, CircleDollarSign,
} from 'lucide-react'

const nav = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Leads', icon: Users },
  { label: 'Employees', icon: UserRoundCheck },
  { label: 'Follow-ups', icon: CalendarClock },
  { label: 'Documents', icon: FileCheck2 },
  { label: 'Applications', icon: ClipboardCheck },
  { label: 'Banks & Schemes', icon: Landmark },
  { label: 'Reports', icon: ChartNoAxesCombined },
]

function Login({ onLogin, startupError }) {
  const [role, setRole] = useState('Admin')
  const [email, setEmail] = useState('admin@leadflow.com')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState(startupError ?? '')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onLogin(role, email, password)
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="login-page">
      <div className="login-brand"><div className="brand-mark"><CircleDollarSign size={26}/></div><span>LeadFlow <small>CRM</small></span></div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-copy"><span>WELCOME BACK</span><h1>Sign in to your account</h1><p>Manage leads, calls and loan applications.</p></div>
        <label>Email address<input type="email" required value={email} onChange={event => setEmail(event.target.value)}/></label>
        <label>Password<input type="password" required value={password} onChange={event => setPassword(event.target.value)}/></label>
        <div className="role-picker"><button type="button" className={role === 'Admin' ? 'selected' : ''} onClick={() => { setRole('Admin'); setEmail('admin@leadflow.com') }}>Admin</button><button type="button" className={role === 'Staff' ? 'selected' : ''} onClick={() => { setRole('Staff'); setEmail('priya@leadflow.com') }}>Staff</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="login-button" disabled={saving}>{saving ? 'Signing in…' : 'Sign in'} <ArrowUpRight size={18}/></button>
        <div className="login-demo"><b>Demo credentials</b><span>{role}: {role === 'Admin' ? 'admin@leadflow.com' : 'priya@leadflow.com'} / password</span></div>
      </form>
    </div>
  )
}

function PageHead({ title, subtitle, action, secondary }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      <div className="page-actions">{secondary}{action}</div>
    </div>
  )
}

function Dashboard({ leads, employees, staffView, setActive, setModal, userName }) {
  const calls = employees.reduce((total, employee) => total + employee.calls, 0)
  const interested = leads.filter(lead => lead.status === 'Interested').length
  const approved = leads.filter(lead => lead.status === 'Approved').length
  const followUps = leads.filter(lead => lead.status === 'Follow-up').length
  const conversionRate = leads.length ? Math.round(((interested + approved) / leads.length) * 100) : 0
  const interestedEnd = leads.length ? (interested / leads.length) * 100 : 0
  const approvedEnd = leads.length ? interestedEnd + (approved / leads.length) * 100 : 0
  const followUpEnd = leads.length ? approvedEnd + (followUps / leads.length) * 100 : 0
  const chartEmployees = employees.slice(0, 7)
  return (
    <>
      <PageHead title={staffView ? `Good morning, ${userName?.split(' ')[0] ?? 'there'}!` : 'Dashboard'} subtitle={staffView ? "Here’s your activity for today" : "Here’s what’s happening with your loan business today."}
        action={<>{!staffView && <button className="secondary" onClick={() => setModal('upload')}><Upload size={16}/> Bulk Upload</button>}<button className="primary" onClick={() => setModal('lead')}><Plus size={17}/> Add Lead</button></>}
      />
      <div className="stats-grid">
        <StatCard icon={Users} label={staffView ? 'My Leads' : 'Total Leads'} value={leads.length.toLocaleString()} change="Live" color="#665af2"/>
        <StatCard icon={PhoneCall} label={staffView ? 'My Calls' : 'Calls Completed'} value={calls.toLocaleString()} change="Live" color="#21a67a"/>
        <StatCard icon={UserRoundCheck} label="Interested" value={interested.toLocaleString()} change="Live" color="#ee9a43"/>
        <StatCard icon={CheckCircle2} label="Employees" value={employees.length.toLocaleString()} change="Live" color="#5a82d6"/>
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-head"><div><h3>Call Performance</h3><p>Daily calls completed vs target</p></div></div>
          <div className="chart">
            {chartEmployees.map(employee => (
              <div className="bar-group" key={employee.id}><div className="bar-track"><div className="bar" style={{height:`${Math.min(employee.calls / employee.target * 100, 100)}%`}}/></div><span title={employee.name}>{employee.name.split(' ')[0]}</span></div>
            ))}
          </div>
        </section>
        <section className="panel conversion-panel">
          <div className="panel-head"><div><h3>Lead Conversion</h3><p>By status</p></div><MoreHorizontal size={19}/></div>
          <div className="donut" style={{background:`conic-gradient(#665af2 0 ${interestedEnd}%, #20a47b ${interestedEnd}% ${approvedEnd}%, #ee9a43 ${approvedEnd}% ${followUpEnd}%, #dfe3ea ${followUpEnd}% 100%)`}}><div><strong>{conversionRate}%</strong><span>Interested / approved</span></div></div>
          <div className="legend">
              <span><i className="purple"/>Interested <b>{interested}</b></span><span><i className="green"/>Approved <b>{approved}</b></span><span><i className="orange"/>Follow-up <b>{followUps}</b></span><span><i className="gray"/>Others <b>{leads.length - interested - approved - followUps}</b></span>
          </div>
        </section>
      </div>
      <section className="panel leads-panel">
        <div className="panel-head"><div><h3>{staffView ? 'My Assigned Leads' : 'Recent Leads'}</h3><p>Latest customer inquiries</p></div><button className="text-btn" onClick={() => setActive(staffView ? 'My Leads' : 'Leads')}>View all <ArrowUpRight size={14}/></button></div>
        <LeadsTable leads={leads.slice(0,5)} compact/>
      </section>
    </>
  )
}

function LeadsPage({ leads, setModal, staffView, statusFilter, setStatusFilter, loanFilter, setLoanFilter, onStatusChange, onSchedule, onViewDetails }) {
  const statuses = ['All Leads', 'New', 'Interested', 'Follow-up']
  return (
    <>
      <PageHead title={staffView ? 'My Leads' : 'Lead Management'} subtitle="Manage customer leads and assignments"
        action={<>{!staffView && <button className="secondary" onClick={() => setModal('assign')}><Users size={16}/> Assign Unassigned</button>}<button className="primary" onClick={() => setModal('lead')}><Plus size={17}/> Add Lead</button></>}
      />
      <div className="filter-bar">
        {statuses.map(status => <button key={status} className={`filter ${statusFilter === status ? 'active' : ''}`} onClick={() => setStatusFilter(status)}>{status}<b>{status === 'All Leads' ? leads.length : leads.filter(lead => lead.status === status).length}</b></button>)}
        <select className="select-btn" aria-label="Filter by loan type" value={loanFilter} onChange={event => setLoanFilter(event.target.value)}>
          <option value="All">All loan types</option>{[...new Set(leads.map(lead => lead.loan))].map(loan => <option key={loan}>{loan}</option>)}
        </select>
      </div>
      <section className="panel"><LeadsTable leads={leads.filter(lead => (statusFilter === 'All Leads' || lead.status === statusFilter) && (loanFilter === 'All' || lead.loan === loanFilter))} onStatusChange={onStatusChange} onSchedule={onSchedule} onViewDetails={onViewDetails}/></section>
    </>
  )
}

function formatFollowUp(value) {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function LeadsTable({ leads, compact=false, onStatusChange, onSchedule, onViewDetails }) {
  return (
    <div className="table-wrap"><table>
      <thead><tr><th>Customer</th><th>Loan Type</th><th>Amount</th><th>Status</th><th>Assigned To</th>{!compact && <><th>Follow-up</th><th>Actions</th></>}</tr></thead>
      <tbody>{leads.map(l => (
        <tr key={l.id}>
          <td><div className="customer"><div className="avatar table-avatar">{l.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div><strong>{l.name}</strong><span>{l.phone}</span></div></div></td>
          <td><strong className="loan-type">{l.loan}</strong></td><td><strong>{l.amount}</strong></td><td><StatusPill status={l.status}/></td>
          <td><span className="assignee">{l.assigned}</span></td>
          {!compact && <td><span className="follow-date">{formatFollowUp(l.follow)}</span></td>}
          {!compact && <td><div className="row-actions"><select className="row-status-select" aria-label={`Change ${l.name} status`} value={l.status} onChange={event => onStatusChange?.(l.id, event.target.value)}>{['New', 'Interested', 'Follow-up', 'Documents', 'Approved', 'Not Interested'].map(status => <option key={status}>{status}</option>)}</select><button className="icon-btn" type="button" aria-label={`View details for ${l.name}`} title="View lead details" onClick={() => onViewDetails?.(l.id)}><Search size={16}/></button><button className="icon-btn" type="button" aria-label={`Schedule follow-up for ${l.name}`} title="Schedule follow-up" onClick={() => onSchedule?.(l.id)}><CalendarClock size={17}/></button></div></td>}
        </tr>
      ))}</tbody>
    </table></div>
  )
}

function LeadDetails({ lead }) {
  return <div className="form-grid">
    <label>Customer<strong>{lead.name}</strong></label>
    <label>Phone<strong>{lead.phone}</strong></label>
    <label>Loan type<strong>{lead.loan}</strong></label>
    <label>Required amount<strong>{lead.amount}</strong></label>
    <label>Status<strong>{lead.status}</strong></label>
    <label>Assigned to<strong>{lead.assigned}</strong></label>
    <label>Follow-up<strong>{formatFollowUp(lead.followUpAt ?? lead.follow)}</strong></label>
    <label>Source<strong>{lead.source || 'Not specified'}</strong></label>
    <label>Created<strong>{lead.createdAt ? new Date(lead.createdAt).toLocaleString() : 'Not available'}</strong></label>
    <label className="full">Notes<textarea readOnly value={lead.notes?.trim() || 'No notes added.'}/></label>
  </div>
}

function EmployeesPage({ employees, onAdd }) {
  return (
    <>
      <PageHead title="Employee Management" subtitle={`${employees.length} team members · daily call targets`} action={<button className="primary" onClick={onAdd}><Plus size={17}/> Add Employee</button>}/>
      <div className="employee-grid">{employees.map(e => (
        <section className="employee-card" key={e.id}>
          <div className="employee-top"><div className="avatar employee-avatar" style={{background:['#6c63ff','#20a47b','#ee9a43','#5c88c6'][e.id % 4]}}>{e.name.split(' ').map(part => part[0]).join('').slice(0,2)}</div><div><h3>{e.name}</h3><span>{e.status}</span></div><span className="employee-email">{e.email}</span></div>
          <div className="target-head"><span>Daily Call Target</span><strong>{e.calls} / {e.target}</strong></div>
          <div className="progress"><i style={{width:`${e.target ? Math.min(e.calls / e.target * 100, 100) : 0}%`}}/></div>
          <div className="employee-stats"><div><strong>{e.assigned_leads}</strong><span>Assigned leads</span></div><div><strong>{Math.round(e.calls/e.target*100)}%</strong><span>Target</span></div><div><strong>{e.calls}</strong><span>Calls today</span></div></div>
        </section>
      ))}</div>
    </>
  )
}

function FollowupsPage({ items, onCall }) {
  return (
    <>
      <PageHead title="Follow-ups" subtitle="Scheduled customer callbacks" />
      {items.length === 0 ? <section className="panel empty-state">No follow-ups scheduled yet.</section> : <div className="timeline">{items.map((item, index)=><div className="timeline-row" key={item.id}><time>{new Date(item.followUpAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time><div className="timeline-dot"/><section className="follow-card"><div><span>#{index + 1} · {item.loan}</span><h3>{item.name}</h3><p>Assigned to {item.assigned}</p></div><button className="secondary" onClick={() => onCall(item.id)}><Phone size={15}/> Log Call</button></section></div>)}</div>}
    </>
  )
}

function DocumentsPage({ documents, staffView, onUpload, onReview }) {
  return (
    <>
      <PageHead title="Document Verification" subtitle={`${documents.length} customer documents`} action={<button className="primary" onClick={onUpload}><Upload size={16}/> Upload Document</button>}/>
      {documents.length === 0 ? <section className="panel empty-state">No documents uploaded yet.</section> : <section className="panel"><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Document</th><th>Status</th><th>Uploaded</th><th>Actions</th></tr></thead><tbody>{documents.map(document=><tr key={document.id}><td><strong>{document.customer}</strong></td><td><a className="doc-name document-link" href={`/api/documents/${document.id}/download`}><FileCheck2 size={16}/>{document.documentType}<small>{document.fileName}</small></a></td><td><StatusPill status={document.status}/></td><td>{new Date(document.uploadedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td><td><div className="row-actions"><a className="text-btn" href={`/api/documents/${document.id}/download`}>Download</a>{!staffView && <select className="row-status-select" aria-label={`Review ${document.fileName}`} value={document.status} onChange={event => onReview(document.id, event.target.value)}><option>Pending</option><option>Verified</option><option>Rejected</option></select>}</div></td></tr>)}</tbody></table></div></section>}
    </>
  )
}

function ApplicationsPage({ applications, onAdd, onStatusChange }) {
  return (
    <>
      <PageHead title="Loan Applications" subtitle={`${applications.length} applications tracked`} action={<button className="primary" onClick={onAdd}><Plus size={17}/> New Application</button>}/>
      {applications.length === 0 ? <section className="panel empty-state">No applications created yet.</section> : <section className="panel"><div className="table-wrap"><table><thead><tr><th>Application</th><th>Customer</th><th>Bank</th><th>Scheme</th><th>Amount</th><th>Status</th></tr></thead><tbody>{applications.map(application=><tr key={application.id}><td><strong>{application.id}</strong></td><td>{application.customer}</td><td>{application.bank}</td><td>{application.scheme}</td><td><strong>{application.amount}</strong></td><td><select className="row-status-select" aria-label={`Update ${application.id} status`} value={application.status} onChange={event => onStatusChange(application.id, event.target.value)}>{['Under Review', 'Documents', 'Approved', 'Rejected', 'Disbursed', 'Closed'].map(status => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div></section>}
    </>
  )
}

function BanksPage({ banks, onAdd }) {
  return (
    <>
      <PageHead title="Banks & Loan Schemes" subtitle={`${banks.length} partner banks`} action={<button className="primary" onClick={onAdd}><Plus size={17}/> Add Bank</button>}/>
      <div className="bank-grid">{banks.map(bank=><section className="bank-card" key={bank.id}><div className="bank-logo" style={{background:`${bank.color}18`,color:bank.color}}><Landmark size={22}/></div><div><h3>{bank.name}</h3><p>{bank.loanTypes}</p><span>{bank.schemeCount} schemes</span></div></section>)}</div>
    </>
  )
}

function ReportsPage({ leads, employees }) {
  const totalCalls = employees.reduce((total, employee) => total + employee.calls, 0)
  const approved = leads.filter(lead => lead.status === 'Approved').length
  const interested = leads.filter(lead => lead.status === 'Interested').length
  function exportReport() {
    const fields = ['Employee', 'Email', 'Calls Completed', 'Daily Target', 'Assigned Leads']
    const rows = employees.map(employee => [employee.name, employee.email, employee.calls, employee.target, employee.assigned_leads])
    const csv = [fields, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'leadflow-performance-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageHead title="Reports & Analytics" subtitle="Live team performance from CRM records" action={<button className="secondary" onClick={exportReport}><Download size={16}/> Export CSV</button>}/>
      <div className="stats-grid"><StatCard icon={Users} label="Total Leads" value={leads.length.toLocaleString()} change="Live" color="#665af2"/><StatCard icon={Phone} label="Calls Completed" value={totalCalls.toLocaleString()} change="Live" color="#21a67a"/><StatCard icon={UserRoundCheck} label="Interested" value={interested.toLocaleString()} change="Live" color="#ee9a43"/><StatCard icon={CheckCircle2} label="Approved" value={approved.toLocaleString()} change="Live" color="#5a82d6"/></div>
      <section className="panel chart-panel"><div className="panel-head"><div><h3>Daily Call Targets</h3><p>Calls completed by employee against a 100-call target</p></div></div><div className="chart wide">{employees.slice(0,12).map(employee=><div className="bar-group" key={employee.id}><div className="bar-track"><div className="bar" style={{height:`${Math.min(employee.calls / employee.target * 100, 100)}%`}}/></div><span title={employee.name}>{employee.name.split(' ')[0]}</span></div>)}</div></section>
    </>
  )
}

function LeadForm({ employees, allowAssignment, onSubmit, onCancel }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const form = new FormData(event.currentTarget)
    try {
      const lead = {
        name: form.get('name'),
        phone: form.get('phone'),
        loan: form.get('loan'),
        amount: form.get('amount'),
        notes: form.get('notes'),
      }
      if (allowAssignment) {
        const assignedEmployeeId = form.get('assignedEmployeeId')
        lead.assignedEmployeeId = assignedEmployeeId ? Number(assignedEmployeeId) : null
      }
      await onSubmit(lead)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className="form-grid" onSubmit={submit}><label>Customer Name<input name="name" required maxLength="120" placeholder="Enter full name"/></label><label>Phone Number<input name="phone" required maxLength="40" placeholder="+91 00000 00000"/></label><label>Loan Type<select name="loan"><option>Personal Loan</option><option>Home Loan</option><option>Business Loan</option><option>Car Loan</option><option>Education Loan</option></select></label><label>Required Amount<input name="amount" required maxLength="40" placeholder="₹ 5,00,000"/></label>{allowAssignment && <label className="full">Assign to staff<select name="assignedEmployeeId" defaultValue=""><option value="">Leave unassigned</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>}<label className="full">Notes<textarea name="notes" maxLength="2000" placeholder="Add call notes or requirements"/></label>{error && <p className="form-error full" role="alert">{error}</p>}<div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Lead'}</button></div></form>
}

function Assignment({ employees, onSubmit, onCancel }) {
  const [employeeId, setEmployeeId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit(Number(employeeId))
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className="form-grid" onSubmit={submit}><label className="full">Assign all unassigned leads to<select required value={employeeId} onChange={event => setEmployeeId(event.target.value)}><option value="">Select an employee</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>{error && <p className="form-error full" role="alert">{error}</p>}<div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Assigning…' : 'Assign Unassigned Leads'}</button></div></form>
}

function EmployeeForm({ onSubmit, onCancel }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const form = new FormData(event.currentTarget)
    try {
      await onSubmit({ name: form.get('name'), email: form.get('email'), password: form.get('password') })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className="form-grid" onSubmit={submit}><label className="full">Employee name<input name="name" required maxLength="120" placeholder="Full name"/></label><label className="full">Work email<input name="email" type="email" required maxLength="254" placeholder="name@company.com"/></label><label className="full">Temporary password<input name="password" type="password" required minLength="8" maxLength="1024" autoComplete="new-password" placeholder="At least 8 characters"/></label><p className="form-hint full">This creates a staff login and sets the daily call target to 100.</p>{error && <p className="form-error full" role="alert">{error}</p>}<div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Employee'}</button></div></form>
}

function FollowUpForm({ lead, onSubmit, onCancel }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const dateTime = new FormData(event.currentTarget).get('followUpAt')
    try {
      await onSubmit(new Date(dateTime).toISOString())
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)
  return <form className="form-grid" onSubmit={submit}><label className="full">Customer<input value={lead.name} readOnly/></label><label className="full">Follow-up date and time<input name="followUpAt" type="datetime-local" required min={localNow}/></label>{error && <p className="form-error full" role="alert">{error}</p>}<div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule Follow-up'}</button></div></form>
}

function CsvImport({ onImport, onCancel }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (!file) {
      setError('Choose a CSV file first.')
      return
    }
    if (file.size > 1024 * 1024) {
      setError('The CSV file must be 1 MB or smaller.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const leads = parseLeadCsv(await file.text())
      if (leads.length > 500) throw new Error('A single upload can contain at most 500 leads.')
      await onImport(leads)
    } catch (importError) {
      setError(importError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className="form-grid" onSubmit={submit}><p className="form-hint full">CSV columns: name, phone, loan, amount. Optional: source, notes. Maximum 500 rows.</p><label className="full">CSV file<input type="file" accept=".csv,text/csv" onChange={event => { setFile(event.target.files?.[0] ?? null); setError('') }}/></label>{file && <p className="form-hint full">Selected: {file.name}</p>}{error && <p className="form-error full" role="alert">{error}</p>}<div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Importing…' : 'Import CSV'}</button></div></form>
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function DocumentUploadForm({ leads, onSubmit, onCancel }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (!file) {
      setError('Choose a document file first.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('The document must be 4 MB or smaller.')
      return
    }
    setError('')
    setSaving(true)
    const form = new FormData(event.currentTarget)
    try {
      await onSubmit({
        leadId: form.get('leadId'),
        documentType: form.get('documentType'),
        fileName: file.name,
        mimeType: file.type || ({ '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }[file.name.slice(file.name.lastIndexOf('.')).toLowerCase()] ?? ''),
        contentBase64: await fileToBase64(file),
      })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className="form-grid" onSubmit={submit}><label className="full">Customer lead<select name="leadId" required defaultValue=""><option value="" disabled>Select a lead</option>{leads.map(lead=><option key={lead.id} value={lead.id}>{lead.name} · {lead.id}</option>)}</select></label><label className="full">Document type<select name="documentType"><option>PAN Card</option><option>Identity Proof</option><option>Address Proof</option><option>Salary Slips</option><option>Bank Statement</option><option>Other</option></select></label><label className="full">PDF, JPG, or PNG (max 4 MB)<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => { setFile(event.target.files?.[0] ?? null); setError('') }}/></label>{file && <p className="form-hint full">Selected: {file.name} ({Math.ceil(file.size / 1024)} KB)</p>}{error && <p className="form-error full" role="alert">{error}</p>}<div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={saving || leads.length === 0}>{saving ? 'Uploading…' : 'Upload Document'}</button></div></form>
}

function ApplicationForm({ leads, banks, onSubmit, onCancel }) {
  const [leadId, setLeadId] = useState(leads[0]?.id ?? '')
  const selectedLead = leads.find(lead => lead.id === leadId)
  const [scheme, setScheme] = useState(selectedLead?.loan ?? '')
  const [amount, setAmount] = useState(selectedLead?.amount ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const form = new FormData(event.currentTarget)
    try {
      await onSubmit({
        leadId: form.get('leadId'),
        bankId: Number(form.get('bankId')),
        scheme: form.get('scheme'),
        amount: form.get('amount'),
      })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className="form-grid" onSubmit={submit}><label className="full">Customer lead<select name="leadId" required value={leadId} onChange={event => { const nextLead = leads.find(lead => lead.id === event.target.value); setLeadId(event.target.value); setScheme(nextLead?.loan ?? ''); setAmount(nextLead?.amount ?? '') }}><option value="" disabled>Select a lead</option>{leads.map(lead=><option key={lead.id} value={lead.id}>{lead.name} · {lead.id}</option>)}</select></label><label className="full">Partner bank<select name="bankId" required defaultValue=""><option value="" disabled>Select a bank</option>{banks.map(bank=><option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label><label className="full">Loan scheme<input name="scheme" required maxLength="120" value={scheme} onChange={event => setScheme(event.target.value)}/></label><label className="full">Application amount<input name="amount" required maxLength="40" value={amount} onChange={event => setAmount(event.target.value)}/></label>{error && <p className="form-error full" role="alert">{error}</p>}<div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={saving || leads.length === 0 || banks.length === 0}>{saving ? 'Creating…' : 'Create Application'}</button></div></form>
}

function BankForm({ onSubmit, onCancel }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const form = new FormData(event.currentTarget)
    try {
      await onSubmit({
        name: form.get('name'),
        loanTypes: form.get('loanTypes'),
        schemeCount: Number(form.get('schemeCount')),
        color: form.get('color'),
      })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className="form-grid" onSubmit={submit}><label className="full">Bank name<input name="name" required maxLength="120" placeholder="Bank name"/></label><label className="full">Loan types (comma-separated)<input name="loanTypes" required maxLength="300" placeholder="Home, Personal, Car"/></label><label>Number of schemes<input name="schemeCount" type="number" min="0" max="10000" required defaultValue="0"/></label><label>Brand color<input name="color" type="color" defaultValue="#665af2"/></label>{error && <p className="form-error full" role="alert">{error}</p>}<div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Bank'}</button></div></form>
}

function StatCard({ icon: Icon, label, value, change, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}18`, color }}><Icon size={20} /></div>
      <div className="stat-copy"><span>{label}</span><strong>{value}</strong></div>
      <div className="stat-change"><ArrowUpRight size={13} /> {change}</div>
    </div>
  )
}

function StatusPill({ status }) {
  const cls = status.toLowerCase().replaceAll(' ', '-').replace('&', 'and')
  return <span className={`status status-${cls}`}><i />{status}</span>
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
        {children}
      </div>
    </div>
  )
}

async function migrateStoredLeads(currentLeads) {
  const legacyData = localStorage.getItem('lf_leads')
  localStorage.removeItem('lf_session')
  localStorage.removeItem('lf_role')
  if (!legacyData) return { leads: currentLeads, migratedCount: 0 }

  const storedLeads = JSON.parse(legacyData)
  if (!Array.isArray(storedLeads)) throw new Error('Stored lead data is not a list.')
  const knownPhones = new Set(currentLeads.map(lead => lead.phone))
  const migrationCandidates = storedLeads.filter(lead => lead && lead.phone && !knownPhones.has(String(lead.phone)))
  let migratedCount = 0
  for (let index = 0; index < migrationCandidates.length; index += 500) {
    const batch = migrationCandidates.slice(index, index + 500).map(lead => ({
      name: lead.name,
      phone: lead.phone,
      loan: lead.loan,
      amount: lead.amount,
      status: lead.status || 'New',
      assignedEmployeeId: lead.assignedEmployeeId,
      assigned: lead.assigned,
      followUpAt: lead.followUpAt ?? lead.follow_up_at ?? lead.follow ?? null,
      source: lead.source || 'Migrated from local demo',
      notes: lead.notes || '',
      createdAt: lead.createdAt ?? lead.created_at,
    }))
    await api('/api/leads/import', { method: 'POST', body: { leads: batch } })
    batch.forEach(lead => knownPhones.add(String(lead.phone)))
    migratedCount += batch.length
  }
  localStorage.removeItem('lf_leads')
  return {
    leads: migratedCount ? (await api('/api/leads')).leads : currentLeads,
    migratedCount,
  }
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [role, setRole] = useState('Admin')
  const [currentUser, setCurrentUser] = useState(null)
  const [active, setActive] = useState('Dashboard')
  const [leads, setLeads] = useState([])
  const [employees, setEmployees] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [documents, setDocuments] = useState([])
  const [applications, setApplications] = useState([])
  const [banks, setBanks] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Leads')
  const [loanFilter, setLoanFilter] = useState('All')
  const [modal, setModal] = useState(null)
  const [selectedLeadId, setSelectedLeadId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState('')
  const legacyMigration = useRef({ promise: null, completed: false })
  const mobileRoute = window.location.pathname.endsWith('/mobile') || window.location.hash === '#/mobile'

  useEffect(() => {
    let activeEffect = true
    api('/api/auth/me')
      .then(({ user }) => {
        if (!activeEffect || !user) return
        setCurrentUser(user)
        setRole(user.role)
        setActive(user.role === 'Staff' ? 'My Leads' : 'Dashboard')
        setLoggedIn(true)
      })
      .catch(error => {
        if (error.status !== 401) setAuthError(error.message)
      })
      .finally(() => {
        if (activeEffect) setAuthLoading(false)
      })
    return () => { activeEffect = false }
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    let activeEffect = true
    Promise.all([
      api('/api/leads'),
      api('/api/employees'),
      api('/api/follow-ups'),
      api('/api/documents'),
      api('/api/applications'),
      api('/api/banks'),
    ])
      .then(async ([leadData, employeeData, followUpData, documentData, applicationData, bankData]) => {
        if (!activeEffect) return
        let currentLeads = leadData.leads
        if (role === 'Admin' && !legacyMigration.current.completed) {
          if (!legacyMigration.current.promise) legacyMigration.current.promise = migrateStoredLeads(currentLeads)
          try {
            const result = await legacyMigration.current.promise
            currentLeads = result.leads
            legacyMigration.current.completed = true
            if (result.migratedCount) notify(`${result.migratedCount} existing browser lead${result.migratedCount === 1 ? '' : 's'} migrated.`)
          } catch (error) {
            legacyMigration.current.promise = null
            if (activeEffect) notify(`Existing browser leads were not migrated: ${error.message}`)
          }
        }
        if (!activeEffect) return
        setLeads(currentLeads)
        setEmployees(employeeData.employees)
        setFollowUps(followUpData.followUps)
        setDocuments(documentData.documents)
        setApplications(applicationData.applications)
        setBanks(bankData.banks)
      })
      .catch(error => {
        if (activeEffect) notify(error.message)
      })
    return () => { activeEffect = false }
  }, [loggedIn, role])

  useEffect(() => {
    if (!loggedIn) return
    let activeEffect = true
    let refreshInProgress = false
    let errorNotified = false
    async function refreshTeamData() {
      if (!activeEffect || document.visibilityState === 'hidden' || refreshInProgress) return
      refreshInProgress = true
      try {
        const [leadData, employeeData] = await Promise.all([api('/api/leads'), api('/api/employees')])
        if (!activeEffect) return
        setLeads(leadData.leads)
        setEmployees(employeeData.employees)
        errorNotified = false
      } catch (error) {
        if (activeEffect && !errorNotified) notify(error.message)
        errorNotified = true
      } finally {
        refreshInProgress = false
      }
    }
    const timer = window.setInterval(refreshTeamData, 5000)
    window.addEventListener('focus', refreshTeamData)
    document.addEventListener('visibilitychange', refreshTeamData)
    return () => {
      activeEffect = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshTeamData)
      document.removeEventListener('visibilitychange', refreshTeamData)
    }
  }, [loggedIn])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const visibleLeads = useMemo(() => leads.filter(l =>
    `${l.name} ${l.phone} ${l.loan} ${l.status}`.toLowerCase().includes(search.toLowerCase())
  ), [leads, search])

  async function login(_nextRole, email, password) {
    const { user } = await api('/api/auth/login', { method: 'POST', body: { email, password } })
    setCurrentUser(user)
    setRole(user.role)
    setLoggedIn(true)
    setActive(user.role === 'Staff' ? 'My Leads' : 'Dashboard')
  }
  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      notify(error.message)
      return
    }
    setLoggedIn(false)
    setCurrentUser(null)
    setLeads([])
    setEmployees([])
    setFollowUps([])
    setDocuments([])
    setApplications([])
    setBanks([])
  }
  function notify(message) { setToast(message) }

  async function changeLeadStatus(id, status) {
    try {
      await api(`/api/leads/${id}`, { method: 'PATCH', body: { status } })
      setLeads(current => current.map(lead => lead.id === id ? { ...lead, status } : lead))
      notify('Lead status updated.')
    } catch (error) {
      notify(error.message)
    }
  }

  async function assignUnassignedLeads(employeeId) {
    const result = await api('/api/leads/assign', { method: 'POST', body: { employeeId } })
    const [leadData, employeeData] = await Promise.all([api('/api/leads'), api('/api/employees')])
    setLeads(leadData.leads)
    setEmployees(employeeData.employees)
    setModal(null)
    notify(`${result.assignedCount} unassigned lead${result.assignedCount === 1 ? '' : 's'} assigned.`)
  }

  async function scheduleFollowUp(leadId, followUpAt) {
    await api(`/api/leads/${leadId}/follow-ups`, { method: 'POST', body: { followUpAt } })
    const [leadData, followUpData] = await Promise.all([api('/api/leads'), api('/api/follow-ups')])
    setLeads(leadData.leads)
    setFollowUps(followUpData.followUps)
    setModal(null)
    setSelectedLeadId(null)
    notify('Follow-up scheduled.')
  }

  async function importLeads(records) {
    const result = await api('/api/leads/import', { method: 'POST', body: { leads: records } })
    const { leads: updatedLeads } = await api('/api/leads')
    setLeads(updatedLeads)
    setModal(null)
    notify(`${result.importedCount} lead${result.importedCount === 1 ? '' : 's'} imported.`)
  }

  async function createEmployee(employee) {
    const { employee: createdEmployee } = await api('/api/employees', { method: 'POST', body: employee })
    setEmployees(current => [...current, createdEmployee])
    setModal(null)
    notify('Employee account created.')
  }

  async function uploadDocument(document) {
    const { document: createdDocument } = await api('/api/documents', { method: 'POST', body: document })
    setDocuments(current => [createdDocument, ...current])
    setModal(null)
    notify('Document uploaded for verification.')
  }

  async function reviewDocument(id, status) {
    try {
      await api(`/api/documents/${id}`, { method: 'PATCH', body: { status } })
      setDocuments(current => current.map(document => document.id === id ? { ...document, status } : document))
      notify(`Document marked ${status.toLowerCase()}.`)
    } catch (error) {
      notify(error.message)
    }
  }

  async function createApplication(application) {
    const { application: createdApplication } = await api('/api/applications', { method: 'POST', body: application })
    setApplications(current => [createdApplication, ...current])
    setModal(null)
    notify('Loan application created.')
  }

  async function changeApplicationStatus(id, status) {
    try {
      await api(`/api/applications/${id}`, { method: 'PATCH', body: { status } })
      setApplications(current => current.map(application => application.id === id ? { ...application, status } : application))
      if (status === 'Approved') {
        setLeads(current => current.map(lead => {
          const application = applications.find(item => item.id === id)
          return lead.id === application?.leadId ? { ...lead, status: 'Approved' } : lead
        }))
      }
      notify('Application status updated.')
    } catch (error) {
      notify(error.message)
    }
  }

  async function createBank(bank) {
    const { bank: createdBank } = await api('/api/banks', { method: 'POST', body: bank })
    setBanks(current => [...current, createdBank].sort((a, b) => a.name.localeCompare(b.name)))
    setModal(null)
    notify('Bank and schemes added.')
  }

  async function logCall(leadId) {
    try {
      await api(`/api/leads/${leadId}/calls`, { method: 'POST', body: { outcome: 'Call completed' } })
      const [leadData, employeeData, followUpData] = await Promise.all([api('/api/leads'), api('/api/employees'), api('/api/follow-ups')])
      setLeads(leadData.leads)
      setEmployees(employeeData.employees)
      setFollowUps(followUpData.followUps)
      notify('Call logged.')
    } catch (error) {
      notify(error.message)
    }
  }

  if (authLoading) return <div className="loading-screen">Loading LeadFlow CRM…</div>
  if (!loggedIn) return <Login onLogin={login} startupError={authError} />

  const staffView = role === 'Staff'
  const selectedLead = leads.find(lead => lead.id === selectedLeadId)

  return (
    <div className={`app-shell ${mobileRoute ? 'mobile-route' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><CircleDollarSign size={22}/></div><span>LeadFlow</span></div>
        <nav>
          <p className="nav-caption">{staffView ? 'WORKSPACE' : 'MAIN MENU'}</p>
          {(staffView
            ? [{label:'My Dashboard',icon:LayoutDashboard},{label:'My Leads',icon:Users,badge:String(leads.length)},{label:'Follow-ups',icon:CalendarClock,badge:String(followUps.length)},{label:'Documents',icon:FileCheck2},{label:'Applications',icon:ClipboardCheck},{label:'Performance',icon:ChartNoAxesCombined}]
            : nav.map(item => item.label === 'Leads' ? { ...item, badge: String(leads.length) } : item)
          ).map(item => (
            <button key={item.label} className={(active === item.label || (!staffView && active === item.label)) ? 'nav-item active' : 'nav-item'}
              onClick={() => { setActive(item.label); setSidebarOpen(false) }}>
              <item.icon size={18}/><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><Settings size={18}/><span>Settings</span></button>
          <div className="user-mini">
            <div className="avatar">{currentUser?.name.split(' ').map(part => part[0]).join('').slice(0,2)}</div>
            <div><strong>{currentUser?.name}</strong><small>{staffView ? 'Call Executive' : 'Administrator'}</small></div>
            <button className="icon-btn" onClick={logout} title="Logout"><LogOut size={17}/></button>
          </div>
        </div>
      </aside>
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      <main>
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={21}/></button>
              <div className="global-search"><Search size={17}/><input aria-label="Search leads" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={event => { if (event.key === 'Enter') setActive(staffView ? 'My Leads' : 'Leads') }} placeholder="Search leads..."/></div>
          <div className="top-actions">
            <button className="icon-btn notification"><Bell size={19}/><i /></button>
            <button className="profile-btn"><div className="avatar small">{currentUser?.name.split(' ').map(part => part[0]).join('').slice(0,2)}</div><span>{currentUser?.name.split(' ')[0]}<ChevronDown size={14}/></span></button>
          </div>
        </header>

        <div className="content">
          {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
          {active === 'Dashboard' || active === 'My Dashboard' ? (
            <Dashboard leads={leads} employees={employees} staffView={staffView} setActive={setActive} setModal={setModal} userName={currentUser?.name} />
          ) : active === 'Leads' || active === 'My Leads' ? (
            <LeadsPage leads={visibleLeads} setModal={setModal} staffView={staffView} statusFilter={statusFilter} setStatusFilter={setStatusFilter} loanFilter={loanFilter} setLoanFilter={setLoanFilter} onStatusChange={changeLeadStatus} onSchedule={leadId => { setSelectedLeadId(leadId); setModal('followup') }} onViewDetails={leadId => { setSelectedLeadId(leadId); setModal('details') }}/>
          ) : active === 'Employees' ? (
            <EmployeesPage employees={employees} onAdd={() => setModal('employee')}/>
          ) : active === 'Follow-ups' ? (
            <FollowupsPage items={followUps} onCall={logCall}/>
          ) : active === 'Documents' ? (
            <DocumentsPage documents={documents} staffView={staffView} onUpload={() => setModal('document')} onReview={reviewDocument}/>
          ) : active === 'Applications' ? (
            <ApplicationsPage applications={applications} onAdd={() => setModal('application')} onStatusChange={changeApplicationStatus}/>
          ) : active === 'Banks & Schemes' ? (
            <BanksPage banks={banks} onAdd={() => setModal('bank')}/>
          ) : active === 'Reports' || active === 'Performance' ? (
            <ReportsPage leads={leads} employees={employees}/>
          ) : (
            <Dashboard leads={leads} employees={employees} staffView={staffView} setActive={setActive} setModal={setModal} userName={currentUser?.name} />
          )}
        </div>
      </main>

      {modal === 'lead' && <Modal title="Add New Lead" onClose={() => setModal(null)}>
        <LeadForm employees={employees} allowAssignment={!staffView} onCancel={() => setModal(null)} onSubmit={async lead => {
          await api('/api/leads', { method: 'POST', body: lead })
          const [leadData, employeeData] = await Promise.all([api('/api/leads'), api('/api/employees')])
          setLeads(leadData.leads)
          setEmployees(employeeData.employees)
          setModal(null)
          notify('Lead added successfully.')
        }}/>
      </Modal>}
      {modal === 'assign' && <Modal title="Assign Unassigned Leads" onClose={() => setModal(null)}>
        <Assignment employees={employees} onCancel={() => setModal(null)} onSubmit={assignUnassignedLeads}/>
      </Modal>}
      {modal === 'details' && selectedLead && <Modal title="Lead Details" onClose={() => { setModal(null); setSelectedLeadId(null) }}>
        <LeadDetails lead={selectedLead}/>
      </Modal>}
      {modal === 'followup' && selectedLead && <Modal title="Schedule Follow-up" onClose={() => { setModal(null); setSelectedLeadId(null) }}>
        <FollowUpForm lead={selectedLead} onCancel={() => { setModal(null); setSelectedLeadId(null) }} onSubmit={followUpAt => scheduleFollowUp(selectedLeadId, followUpAt)}/>
      </Modal>}
      {modal === 'employee' && <Modal title="Add Employee" onClose={() => setModal(null)}>
        <EmployeeForm onCancel={() => setModal(null)} onSubmit={createEmployee}/>
      </Modal>}
      {modal === 'document' && <Modal title="Upload Customer Document" onClose={() => setModal(null)}>
        <DocumentUploadForm leads={leads} onCancel={() => setModal(null)} onSubmit={uploadDocument}/>
      </Modal>}
      {modal === 'application' && <Modal title="Create Loan Application" onClose={() => setModal(null)}>
        <ApplicationForm leads={leads} banks={banks} onCancel={() => setModal(null)} onSubmit={createApplication}/>
      </Modal>}
      {modal === 'bank' && <Modal title="Add Bank & Schemes" onClose={() => setModal(null)}>
        <BankForm onCancel={() => setModal(null)} onSubmit={createBank}/>
      </Modal>}
      {modal === 'upload' && <Modal title="Bulk Upload Leads" onClose={() => setModal(null)}>
        <CsvImport onCancel={() => setModal(null)} onImport={importLeads}/>
      </Modal>}
    </div>
  )
}
