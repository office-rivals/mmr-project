import { useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Ticket } from 'lucide-react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * `/join` — invite code entry. No loader, no API calls: the whole page is a
 * controlled input plus a client-side navigation to `/join/{CODE}`.
 */
export const Route = createFileRoute('/_authed/join/')({
  component: JoinPage,
});

function JoinPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16">
      <Ticket className="h-16 w-16 text-muted-foreground" />
      <div className="flex flex-col gap-2 text-center">
        <PageTitle>Join an Organization</PageTitle>
        <p className="max-w-md text-muted-foreground">
          Enter the 6-character invite code you received to join an
          organization.
        </p>
      </div>

      <InviteCodeForm />
    </div>
  );
}

function InviteCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6 || trimmed.length > 12) {
      setError('Invite code must be 6-12 characters');
      return;
    }
    setError('');
    // Uppercased and trimmed: the input's `uppercase` class is CSS only.
    void router.navigate({ href: `/join/${trimmed}` });
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-code">Invite Code</Label>
        <Input
          id="invite-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="e.g. ABCD2345WXYZ"
          maxLength={12}
          className="text-center text-2xl uppercase tracking-widest"
        />
      </div>
      {/* Validation runs on submit only — the message survives typing. */}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <Button type="submit" disabled={code.trim().length === 0}>
        Continue
      </Button>
    </form>
  );
}
