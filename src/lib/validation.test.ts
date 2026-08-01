import { describe, expect, it } from 'vitest';
import { isLeadFormValid, validateLeadForm, type LeadFormValues } from '@/lib/validation';

const VALID: LeadFormValues = {
  name: 'Asha Menon',
  phone: '9876543210',
  pinCode: '682001',
  email: 'asha@example.com',
  type: 'Residential - Independent Home',
  comment: 'Looking for a 5kW rooftop system.',
};

const withField = (field: keyof LeadFormValues, value: string): LeadFormValues => ({
  ...VALID,
  [field]: value,
});

describe('validateLeadForm', () => {
  it('accepts a complete, well-formed submission', () => {
    expect(validateLeadForm(VALID)).toEqual({});
    expect(isLeadFormValid(validateLeadForm(VALID))).toBe(true);
  });

  it.each([
    ['name', ''],
    ['name', '   '],
    ['pinCode', ''],
    ['email', ''],
    ['type', ''],
    ['comment', ''],
    ['comment', '  \n '],
    ['phone', ''],
  ] as const)('rejects a blank %s (%j)', (field, value) => {
    expect(validateLeadForm(withField(field, value))[field]).toBeTruthy();
  });

  it.each([
    ['9876543210', true], // bare Indian mobile
    ['+919876543210', true], // with country code
    ['98765 43210', true], // spaces are how people write it
    ['98765-43210', true], // and dashes
    ['+1 415 555 0100', true],
    ['987654321', false], // nine digits — one short
    ['12345678901234567', false], // seventeen — one too many
    ['98765abcde', false],
    ['+91 (987) 654-3210', false], // brackets are not stripped
  ])('phone %s -> valid: %s', (phone, valid) => {
    expect(validateLeadForm(withField('phone', phone)).phone === undefined).toBe(valid);
  });

  it.each([
    ['682001', true],
    [' 682001 ', true], // trimmed before testing
    ['68200', false],
    ['6820011', false],
    ['68200a', false],
  ])('pinCode %s -> valid: %s', (pinCode, valid) => {
    expect(validateLeadForm(withField('pinCode', pinCode)).pinCode === undefined).toBe(
      valid,
    );
  });

  it.each([
    ['asha@example.com', true],
    ['asha.menon+solar@sub.example.co.in', true],
    ['asha@example', false], // no dot in the domain
    ['asha example@x.com', false], // whitespace
    ['@example.com', false],
    ['asha@', false],
  ])('email %s -> valid: %s', (email, valid) => {
    expect(validateLeadForm(withField('email', email)).email === undefined).toBe(valid);
  });

  it('reports every failing field at once, not just the first', () => {
    const errors = validateLeadForm({
      name: '',
      phone: 'abc',
      pinCode: '1',
      email: 'no',
      type: '',
      comment: '',
    });
    expect(Object.keys(errors).sort()).toEqual([
      'comment',
      'email',
      'name',
      'phone',
      'pinCode',
      'type',
    ]);
    expect(isLeadFormValid(errors)).toBe(false);
  });

  it('distinguishes a missing value from a malformed one', () => {
    expect(validateLeadForm(withField('phone', '')).phone).toMatch(/enter your phone/i);
    expect(validateLeadForm(withField('phone', '123')).phone).toMatch(/valid phone/i);
  });
});
