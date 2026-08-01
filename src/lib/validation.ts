/**
 * Lead-form validation, ported from the Svelte app's `constants/formValidation.ts`.
 *
 * The rules are deliberately loose: this is the one form a customer fills in
 * during a conversation, and rejecting a legitimate number on a formatting
 * technicality costs a lead. Phone accepts 10–16 digits with an optional `+`,
 * which covers a bare Indian mobile as well as any country code.
 */
export interface LeadFormValues {
  name: string;
  phone: string;
  pinCode: string;
  email: string;
  /** Consultation type — one of `CONSULTATION_TYPES`. */
  type: string;
  comment: string;
}

export type LeadFormErrors = Partial<Record<keyof LeadFormValues, string>>;

export const CONSULTATION_TYPES = [
  'Residential - Independent Home',
  'Residential - Apartments/Housing societies',
  'Business/Commercial',
];

const PHONE_RE = /^\+?\d{10,16}$/;
const PIN_CODE_RE = /^\d{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLeadForm(values: LeadFormValues): LeadFormErrors {
  const errors: LeadFormErrors = {};

  if (!values.name.trim()) errors.name = 'Please enter your name.';

  // Spaces and dashes are how people write phone numbers; strip them before
  // testing rather than making the customer reformat.
  const phone = values.phone.replace(/[\s-]/g, '');
  if (!phone) errors.phone = 'Please enter your phone number.';
  else if (!PHONE_RE.test(phone)) errors.phone = 'Enter a valid phone number.';

  if (!values.pinCode.trim()) errors.pinCode = 'Please enter your PIN code.';
  else if (!PIN_CODE_RE.test(values.pinCode.trim()))
    errors.pinCode = 'A PIN code is 6 digits.';

  if (!values.email.trim()) errors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(values.email.trim()))
    errors.email = 'Enter a valid email address.';

  if (!values.type.trim()) errors.type = 'Please choose a consultation type.';

  if (!values.comment.trim())
    errors.comment = 'Tell us briefly what you are looking for.';

  return errors;
}

export function isLeadFormValid(errors: LeadFormErrors): boolean {
  return Object.keys(errors).length === 0;
}
