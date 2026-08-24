'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { TextField } from '@/components/form-field';
import {
  createOrganization,
  switchActiveOrganization,
} from '@/features/auth/services/members.client';
import {
  createOrganizationSchema,
  slugify,
} from '@/features/auth/validators/auth.validators';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Creates the first (or an additional) organization.
 *
 * The creator becomes owner. The slug is derived from the name but stays editable —
 * it appears in URLs, and users reasonably want control over it.
 */
export function CreateOrganizationForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = createOrganizationSchema.safeParse({
      name,
      ...(effectiveSlug ? { slug: effectiveSlug } : {}),
    });

    if (!parsed.success) {
      const result: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !result[key]) result[key] = issue.message;
      }
      setErrors(result);
      return;
    }

    setErrors({});
    setIsPending(true);

    try {
      const organization = await createOrganization(parsed.data);
      await switchActiveOrganization(organization.id);
    } catch {
      setIsPending(false);
      setFormError('We could not create your organization. Please try again.');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <TextField
        label="Organization name"
        name="name"
        value={name}
        onChange={setName}
        error={errors['name']}
        placeholder="Acme Dental"
        required
        autoFocus
      />

      <TextField
        label="Address"
        name="slug"
        value={effectiveSlug}
        onChange={(value) => {
          setSlugTouched(true);
          setSlug(value);
        }}
        error={errors['slug']}
        hint="Used in URLs. Lowercase letters, numbers, and hyphens."
        required
      />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create organization'}
      </Button>
    </form>
  );
}
