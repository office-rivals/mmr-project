<script lang="ts">
  import { Home, Plus, Shuffle, User } from 'lucide-svelte';
  import MatchmakingButton from './matchmaking-button.svelte';
  import NavbarNav from './navbar-nav.svelte';
</script>

<nav
  class="bg-card fixed bottom-0 left-0 right-0 flex w-screen flex-row justify-center border-t"
>
  <div
    class="flex w-full max-w-screen-sm flex-row items-center justify-stretch"
  >
    <NavbarNav path="/">
      <Home />
    </NavbarNav>
    <MatchmakingButton path="/matchmaking" />
    <NavbarNav isPrimary path="/submit"><Plus /></NavbarNav>
    <NavbarNav path="/random"><Shuffle /></NavbarNav>
    <NavbarNav path="/profile"><User /></NavbarNav>
  </div>
</nav>
