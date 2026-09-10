import { useState } from 'react';
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AlertCircle, Check, Copy, Plus, Trash2 } from 'lucide-react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import {
  failServerAction,
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { formatDate } from '@/lib/utils';
import type { CreateTokenResponse, TokenResponse } from '@/api-v3';

const tokensQueryKey = ['me', 'tokens'] as const;

const listMyTokensFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TokenResponse[]> => {
    try {
      const apiClientV3 = await requireApiClientV3();
      return await apiClientV3.personalAccessTokensApi.listTokens();
    } catch {
      return [];
    }
  }
);

type CreateTokenResult =
  | { status: 'ok'; createdToken: CreateTokenResponse }
  | { status: 'error'; error: string };

async function createToken(data: {
  name: string;
  expiresAt: string;
}): Promise<CreateTokenResult> {
  if (data.name.trim() === '') {
    return failServerAction(400, {
      status: 'error',
      error: 'Token name is required',
    });
  }

  try {
    const apiClientV3 = await requireApiClientV3();
    const result = await apiClientV3.personalAccessTokensApi.generateToken({
      name: data.name.trim(),
      scope: 'write',
      expiresAt:
        data.expiresAt !== ''
          ? new Date(data.expiresAt).toISOString()
          : undefined,
    });
    return { status: 'ok', createdToken: result };
  } catch {
    return failServerAction(500, {
      status: 'error',
      error: 'Failed to create token',
    });
  }
}

const createTokenFn = createServerFn({ method: 'POST' })
  .validator((input: { name: string; expiresAt: string }) => input)
  .handler(({ data }): Promise<CreateTokenResult> => createToken(data));

type RevokeTokenResult = { status: 'ok' } | { status: 'error'; error: string };

async function revokeToken(tokenId: string): Promise<RevokeTokenResult> {
  if (tokenId === '') {
    return failServerAction(400, {
      status: 'error',
      error: 'Token ID is required',
    });
  }
  try {
    const apiClientV3 = await requireApiClientV3();
    await apiClientV3.personalAccessTokensApi.revokeToken(tokenId);
    return { status: 'ok' };
  } catch {
    return failServerAction(500, {
      status: 'error',
      error: 'Failed to revoke token',
    });
  }
}

const revokeTokenFn = createServerFn({ method: 'POST' })
  .validator((tokenId: string) => tokenId)
  .handler(({ data: tokenId }): Promise<RevokeTokenResult> =>
    revokeToken(tokenId)
  );

const tokensQueryOptions = () =>
  queryOptions({
    queryKey: tokensQueryKey,
    queryFn: () => listMyTokensFn(),
    staleTime: 0,
  });

export const Route = createFileRoute('/_authed/settings')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await parseNativeFormData(request);
        if (formData.get('_action') !== 'revokeToken') {
          return new Response('Unsupported form action', { status: 400 });
        }
        const result = await revokeToken(String(formData.get('tokenId') ?? ''));
        return nativeFormResponse(request, {
          ...result,
          success: result.status === 'ok',
        });
      },
    },
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(tokensQueryOptions()),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: tokens = [] } = useQuery(tokensQueryOptions());

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Plaintext is returned once and must survive the list refetch.
  const [createdToken, setCreatedToken] = useState<CreateTokenResponse | null>(
    null
  );

  const createToken = useMutation({
    mutationFn: (input: { name: string; expiresAt: string }) =>
      createTokenFn({ data: input }),
    onSuccess: async (result) => {
      if (result.status === 'error') {
        setCreatedToken(null);
        setError(result.error);
      } else {
        setError(null);
        setCreatedToken(result.createdToken);
        await queryClient.invalidateQueries({ queryKey: tokensQueryKey });
      }
      setShowCreateDialog(false);
    },
    onError: () => {
      setCreatedToken(null);
      setError('Failed to create token');
      setShowCreateDialog(false);
    },
  });

  const revokeToken = useMutation({
    mutationFn: (tokenId: string) => revokeTokenFn({ data: tokenId }),
    onSuccess: async (result) => {
      setCreatedToken(null);
      if (result.status === 'error') {
        setError(result.error);
        return;
      }
      setError(null);
      await queryClient.invalidateQueries({ queryKey: tokensQueryKey });
    },
    onError: () => {
      setCreatedToken(null);
      setError('Failed to revoke token');
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Settings</PageTitle>

      <Card>
        <CardHeader>
          <CardTitle>Personal Access Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Personal access tokens allow you to authenticate with the API
              programmatically. Keep your tokens secure and never share them.
            </p>

            {createdToken != null ? (
              <CreatedTokenCallout token={createdToken.token} />
            ) : null}

            {error ? <ErrorCallout error={error} /> : null}

            {!showCreateDialog ? (
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="w-fit"
              >
                <Plus size={16} />
                Create New Token
              </Button>
            ) : (
              <TokenCreateForm
                isCreating={createToken.isPending}
                onCancel={() => setShowCreateDialog(false)}
                onSubmit={(input) => createToken.mutate(input)}
              />
            )}

            {tokens.length > 0 ? (
              <TokenTable
                tokens={tokens}
                onRevoke={(tokenId) => revokeToken.mutate(tokenId)}
              />
            ) : !showCreateDialog && createdToken == null ? (
              <p className="text-sm text-muted-foreground">
                You don&apos;t have any personal access tokens yet. Create one
                to get started.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreatedTokenCallout({ token }: { token: string }) {
  const [copySuccess, setCopySuccess] = useState(false);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      alert('Failed to copy to clipboard. Please copy manually.');
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-l-4 border-primary bg-green-950/20 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle size={20} className="mt-0.5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="font-semibold text-primary">Save your token now!</p>
          <p className="text-sm text-muted-foreground">
            You won&apos;t be able to see this token again. Copy it now and
            store it securely.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
          {token}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copyToClipboard(token)}
        >
          {copySuccess ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>
    </div>
  );
}

function ErrorCallout({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-l-4 border-red-500 bg-red-950/20 p-4">
      <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
      <p className="text-sm text-red-500">{error}</p>
    </div>
  );
}

function TokenCreateForm({
  isCreating,
  onCancel,
  onSubmit,
}: {
  isCreating: boolean;
  onCancel: () => void;
  onSubmit: (input: { name: string; expiresAt: string }) => void;
}) {
  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-muted p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onSubmit({
          name: String(formData.get('name') ?? ''),
          expiresAt: String(formData.get('expiresAt') ?? ''),
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="token-name" className="text-sm font-medium">
          Token Name
        </label>
        <input
          id="token-name"
          name="name"
          type="text"
          required
          placeholder="e.g., My API Token"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="token-expiry" className="text-sm font-medium">
          Expiration (Optional)
        </label>
        <input
          id="token-expiry"
          name="expiresAt"
          type="datetime-local"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create Token'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TokenTable({
  tokens,
  onRevoke,
}: {
  tokens: TokenResponse[];
  onRevoke: (tokenId: string) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-muted">
      <table className="w-full">
        <thead className="border-b border-muted bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium">
              Last Used
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">Expires</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
            <th className="px-4 py-3 text-right text-sm font-medium">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.id} className="border-b border-muted last:border-0">
              <td className="px-4 py-3 font-medium">{token.name}</td>
              <td
                className="px-4 py-3 text-sm text-muted-foreground"
                suppressHydrationWarning
              >
                {formatDate(token.lastUsedAt, 'Never')}
              </td>
              <td
                className="px-4 py-3 text-sm text-muted-foreground"
                suppressHydrationWarning
              >
                {formatDate(token.expiresAt, 'Never')}
              </td>
              <td
                className="px-4 py-3 text-sm text-muted-foreground"
                suppressHydrationWarning
              >
                {formatDate(token.createdAt, 'Never')}
              </td>
              <td className="px-4 py-3 text-right">
                <form
                  method="post"
                  action="/settings"
                  className="inline"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onRevoke(token.id);
                  }}
                >
                  <input
                    hidden
                    type="hidden"
                    name="_action"
                    value="revokeToken"
                  />
                  <input hidden type="hidden" name="tokenId" value={token.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={(event) => {
                      if (
                        !confirm(
                          'Are you sure you want to revoke this token? This action cannot be undone.'
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    Revoke
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
