import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WidgetShell } from '@/components/chat/widgets/WidgetShell';
import { apiUrl } from '@/lib/api';
import {
  CONSULTATION_TYPES,
  isLeadFormValid,
  validateLeadForm,
  type LeadFormErrors,
  type LeadFormValues,
} from '@/lib/validation';
import { useChatStore } from '@/store/chatStore';

/** `offer_lead_form`. */
export interface LeadFormResult {
  form?: string;
  title?: string;
  description?: string;
  /** Whatever the conversation has already established. */
  prefill?: Partial<Record<keyof LeadFormValues, string>>;
}

const EMPTY_VALUES: LeadFormValues = {
  name: '',
  phone: '',
  pinCode: '',
  email: '',
  type: '',
  comment: '',
};

/**
 * The consultation form the agent offers mid-conversation.
 *
 * This widget is the *only* path from the chat to the leads table — the agent
 * cannot write a lead itself. So the confirmation below is shown on a real
 * success response and never optimistically: a customer told "we'll be in
 * touch" who is then never contacted is worse than an error they can retry.
 */
export function LeadFormCard({ result }: { result: LeadFormResult }) {
  const leadProfile = useChatStore((s) => s.leadProfile);
  const setLeadProfile = useChatStore((s) => s.setLeadProfile);

  const [values, setValues] = useState<LeadFormValues>(() => ({
    ...EMPTY_VALUES,
    // The tool's prefill wins: it is what the customer said most recently. The
    // profile fills the gaps it did not carry.
    name: result.prefill?.name ?? leadProfile.name ?? '',
    phone: result.prefill?.phone ?? leadProfile.phone ?? '',
    pinCode: result.prefill?.pinCode ?? leadProfile.pincode ?? '',
    email: result.prefill?.email ?? leadProfile.email ?? '',
    type: result.prefill?.type ?? '',
    comment: result.prefill?.comment ?? '',
  }));
  const [errors, setErrors] = useState<LeadFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const set = (field: keyof LeadFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear a field's error as soon as it is touched: keeping it visible while
    // someone is fixing it reads as the fix not working.
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateLeadForm(values);
    setErrors(found);
    if (!isLeadFormValid(found)) return;

    setSubmitting(true);
    setFailure(null);
    try {
      const response = await fetch(apiUrl('/api/submit-lead'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        id?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        setFailure(data?.error ?? 'Could not submit the form. Please try again.');
        return;
      }

      setReference(data.id ?? null);
      // The details are now known to the conversation as well, so the agent does
      // not ask for any of them again.
      setLeadProfile({
        name: values.name,
        phone: values.phone,
        email: values.email,
        pincode: values.pinCode,
      });
    } catch (error) {
      console.error('[LeadFormCard] submission failed', error);
      setFailure('Could not reach our servers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (reference !== null) {
    return (
      <WidgetShell emoji="✅" title="Request received">
        <div className="flex items-start gap-2">
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm">
              Thanks{values.name ? `, ${values.name.split(' ')[0]}` : ''} — our team will
              be in touch to arrange quotations from verified installers near you.
            </p>
            {reference && (
              <p className="mt-1 text-xs text-muted-foreground">
                Your reference is <span className="font-mono">{reference}</span>.
              </p>
            )}
          </div>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      emoji="📝"
      title={result.title ?? 'Get your solar consultation'}
      subtitle={result.description}
    >
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field id="lead-name" label="Name" error={errors.name}>
          <Input
            id="lead-name"
            value={values.name}
            onChange={(e) => set('name')(e.target.value)}
            autoComplete="name"
            aria-invalid={!!errors.name}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field id="lead-phone" label="Phone" error={errors.phone}>
            <Input
              id="lead-phone"
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={(e) => set('phone')(e.target.value)}
              autoComplete="tel"
              aria-invalid={!!errors.phone}
            />
          </Field>

          <Field id="lead-pin" label="PIN code" error={errors.pinCode}>
            <Input
              id="lead-pin"
              inputMode="numeric"
              maxLength={6}
              value={values.pinCode}
              onChange={(e) => set('pinCode')(e.target.value)}
              autoComplete="postal-code"
              aria-invalid={!!errors.pinCode}
            />
          </Field>
        </div>

        <Field id="lead-email" label="Email" error={errors.email}>
          <Input
            id="lead-email"
            type="email"
            value={values.email}
            onChange={(e) => set('email')(e.target.value)}
            autoComplete="email"
            aria-invalid={!!errors.email}
          />
        </Field>

        <Field id="lead-type" label="Consultation type" error={errors.type}>
          <Select value={values.type} onValueChange={set('type')}>
            <SelectTrigger id="lead-type" className="w-full" aria-invalid={!!errors.type}>
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              {CONSULTATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="lead-comment" label="What are you looking for?" error={errors.comment}>
          <Textarea
            id="lead-comment"
            rows={3}
            value={values.comment}
            onChange={(e) => set('comment')(e.target.value)}
            className="resize-none"
            aria-invalid={!!errors.comment}
          />
        </Field>

        {failure && (
          <p role="alert" className="text-xs text-destructive">
            {failure}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Sending…' : 'Request a consultation'}
        </Button>
      </form>
    </WidgetShell>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
