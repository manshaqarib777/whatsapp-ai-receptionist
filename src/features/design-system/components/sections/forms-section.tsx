'use client';

import { useState } from 'react';

import { DatePicker } from '@/components/date-picker';
import { FormField, TextField } from '@/components/form-field';
import { TimePicker } from '@/components/time-picker';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Row, Section } from '@/features/design-system/components/section';

export function FormsSection() {
  const [name, setName] = useState('Acme Dental');
  const [email, setEmail] = useState('not-an-email');
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 7, 1));
  const [time, setTime] = useState<string | undefined>('09:30');
  const [checked, setChecked] = useState(true);

  return (
    <Section
      id="forms"
      title="Forms"
      description="Single column, visible labels, errors below the field in reserved space."
    >
      <Card>
        <CardContent className="max-w-md space-y-4">
          <TextField
            label="Business name"
            name="business"
            value={name}
            onChange={setName}
          />

          <TextField
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            error="Enter a valid email address, e.g. alex@acme.com."
          />

          <TextField
            label="Website"
            name="website"
            type="url"
            value=""
            onChange={() => {}}
            required={false}
            hint="Shown to customers when the AI shares your details."
            placeholder="https://acme.example"
          />

          <TextField
            label="Disabled"
            name="disabled"
            value="Cannot be edited"
            onChange={() => {}}
            disabled
          />

          <FormField label="Role">
            {(field) => (
              <Select>
                <SelectTrigger {...field}>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label="Greeting"
            hint="The first thing a customer sees when they message you."
          >
            {(field) => <Textarea {...field} placeholder="Hi! How can we help today?" />}
          </FormField>

          {/* Genuinely paired values — the one case where side-by-side is allowed. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Appointment date">
              {(field) => <DatePicker {...field} value={date} onChange={setDate} />}
            </FormField>

            <FormField label="Appointment time">
              {(field) => (
                <TimePicker
                  {...field}
                  value={time}
                  onChange={setTime}
                  stepMinutes={30}
                  from="08:00"
                  to="18:00"
                />
              )}
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Row label="Choice controls">
        <div className="flex items-center gap-2">
          <Checkbox
            id="g-check"
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
          />
          <Label htmlFor="g-check">Send delivery receipts</Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="g-check-disabled" disabled />
          <Label htmlFor="g-check-disabled">Disabled</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="g-switch" defaultChecked />
          <Label htmlFor="g-switch">Enable AI replies</Label>
        </div>
      </Row>

      <RadioGroup defaultValue="comfortable" aria-label="Density" className="space-y-2">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="comfortable" id="g-r1" />
          <Label htmlFor="g-r1">Comfortable</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="compact" id="g-r2" />
          <Label htmlFor="g-r2">Compact</Label>
        </div>
      </RadioGroup>

      <Row label="Field width signals expected input">
        <div className="space-y-2">
          <Label htmlFor="g-postcode">Postcode</Label>
          <Input id="g-postcode" placeholder="SW1A 1AA" className="w-32" />
        </div>
      </Row>
    </Section>
  );
}
