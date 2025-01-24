import { SvelteKitAuth } from '@auth/sveltekit';
import Auth0 from '@auth/sveltekit/providers/auth0';

export const { handle, signIn } = SvelteKitAuth({
  providers: [Auth0],
  callbacks: {
    jwt: async ({ token, account }) => {
      if (account) {
        return { ...token, accessToken: account?.access_token };
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (token) {
        return { ...session, accessToken: token.accessToken };
      }

      return session;
    },
  },
});
