import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLeadCsv } from './csv.js'

test('parses CSV files with a UTF-8 BOM in the header', () => {
  const leads = parseLeadCsv('\uFEFFname,phone,loan,amount\nAsha,123,Personal Loan,500000')

  assert.deepEqual(leads, [{
    name: 'Asha',
    phone: '123',
    loan: 'Personal Loan',
    amount: '500000',
    source: 'CSV import',
    notes: '',
  }])
})

test('preserves escaped quotes and commas in CSV fields', () => {
  const leads = parseLeadCsv('name,phone,loan,amount,notes\n"Asha, Devi",123,Home,500000,"said ""yes"""\n')

  assert.equal(leads[0].name, 'Asha, Devi')
  assert.equal(leads[0].notes, 'said "yes"')
})
