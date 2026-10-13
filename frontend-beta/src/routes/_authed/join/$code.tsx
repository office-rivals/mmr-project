import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  failServerAction,
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import type { InviteInfoResponse } from '@/api-v3';

interface InviteLanding {
  invite: InviteInfoResponse;
  alreadyMember: boolean;
}

const getInviteLandingFn = createServerFn({ method: 'GET' })
  .validator((code: string) => code)
  .handler(async ({ data: code }): Promise<InviteLanding> => {
    const apiClientV3 = await requireApiClientV3();
    const [info, me] = await Promise.all([
      apiClientV3.invitesApi.getInviteInfo(code),
      apiClientV3.meApi.getMe(),
    ]);

    const alreadyMember =
      info.isValid &&
      (me.organizations ?? []).some(
        (org) => org.slug === info.organizationSlug
      );

    return { invite: info, alreadyMember };
  });

type JoinResult =
  | { status: 'ok'; organizationSlug: string }
  | { status: 'error'; error: string };

async function joinOrganization(code: string): Promise<JoinResult> {
  const apiClientV3 = await requireApiClientV3();
  try {
    const result = await apiClientV3.invitesApi.joinOrganization(code);
    return { status: 'ok', organizationSlug: result.organizationSlug };
  } catch {
    return failServerAction(400, {
      status: 'error',
      error:
        'Failed to join organization. The invite may be invalid or expired.',
    });
  }
}

const joinOrganizationFn = createServerFn({ method: 'POST' })
  .validator((code: string) => code)
  .handler(({ data: code }): Promise<JoinResult> => joinOrganization(code));

export const Route = createFileRoute('/_authed/join/$code')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const formData = await parseNativeFormData(request);
        if (formData.get('_action') !== 'join') {
          return new Response('Unsupported form action', { status: 400 });
        }
        const result = await joinOrganization(params.code);
        if (result.status === 'error') {
          return nativeFormResponse(request, result);
        }
        return new Response(null, {
          status: 303,
          headers: { location: `/${result.organizationSlug}` },
        });
      },
    },
  },
  loader: ({ context, params }) =>
    context.queryClient.fetchQuery({
      queryKey: ['invite', params.code],
      queryFn: () => getInviteLandingFn({ data: params.code }),
      staleTime: 0,
    }),
  component: InviteLandingPage,
});

function InviteLandingPage() {
  const { invite, alreadyMember } = Route.useLoaderData();
  const { code } = Route.useParams();

  return (
    <InviteLandingContent
      key={code}
      invite={invite}
      alreadyMember={alreadyMember}
    />
  );
}

function InviteLandingContent({ invite, alreadyMember }: InviteLanding) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16">
      {!invite.isValid ? (
        <InvalidInviteState organizationName={invite.organizationName} />
      ) : alreadyMember ? (
        <AlreadyMemberCard
          organizationName={invite.organizationName}
          organizationSlug={invite.organizationSlug}
        />
      ) : (
        <InviteClaimCard organizationName={invite.organizationName} />
      )}
    </div>
  );
}

function InvalidInviteState({
  organizationName,
}: {
  organizationName: string;
}) {
  return (
    <>
      <AlertCircle className="h-16 w-16 text-red-500" />
      <div className="flex flex-col gap-2 text-center">
        <PageTitle>Invalid Invite</PageTitle>
        <p className="max-w-md text-muted-foreground">
          {organizationName ? (
            <>
              This invite to <strong>{organizationName}</strong> has expired or
              reached its usage limit.
            </>
          ) : (
            'This invite code is not valid. Please check the code and try again.'
          )}
        </p>
      </div>
      <Button asChild variant="outline">
        <AppLink to="/join">Try Another Code</AppLink>
      </Button>
    </>
  );
}

function AlreadyMemberCard({
  organizationName,
  organizationSlug,
}: {
  organizationName: string;
  organizationSlug: string;
}) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <CheckCircle2 className="mb-2 h-12 w-12 text-green-500" />
        <CardTitle>You&apos;re already a member</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              You&apos;re already a member of
            </p>
            <p className="text-2xl font-bold">{organizationName}</p>
          </div>
          <Button asChild className="w-full">
            <AppLink to={`/${organizationSlug}`}>
              Go to {organizationName}
            </AppLink>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteClaimCard({ organizationName }: { organizationName: string }) {
  const { code } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: () => joinOrganizationFn({ data: code }),
    onSuccess: async (result) => {
      if (result.status === 'error') {
        setError(result.error);
        return;
      }
      setError(null);
      queryClient.removeQueries({ queryKey: ['invite', code], exact: true });
      await router.navigate({ href: `/${result.organizationSlug}` });
    },
    onError: () =>
      setError(
        'Failed to join organization. The invite may be invalid or expired.'
      ),
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <Building2 className="mb-2 h-12 w-12 text-primary" />
        <CardTitle>You&apos;ve been invited!</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              You&apos;re invited to join
            </p>
            <p className="text-2xl font-bold">{organizationName}</p>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-l-4 border-red-500 bg-red-950/20 p-4">
              <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : null}

          <form
            method="post"
            action={`/join/${code}`}
            onSubmit={(event) => {
              event.preventDefault();
              join.mutate();
            }}
          >
            <input hidden type="hidden" name="_action" value="join" />
            <Button type="submit" className="w-full" disabled={join.isPending}>
              {join.isPending ? 'Joining...' : 'Join Organization'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
