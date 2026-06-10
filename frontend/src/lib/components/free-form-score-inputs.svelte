<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { MAX_SCORE } from '$lib/scoring';

  let {
    team1Label,
    team2Label,
    team1Score = $bindable(),
    team2Score = $bindable(),
  }: {
    team1Label: string;
    team2Label: string;
    team1Score: number;
    team2Score: number;
  } = $props();

  // Scores are integers in 0..MAX_SCORE (the API's cap); -1 is the pages'
  // "not entered yet" sentinel, so anything unparsable or out of range maps
  // back to it and keeps the submit step hidden.
  function parseScore(target: HTMLInputElement): number {
    const n = target.valueAsNumber;
    return Number.isInteger(n) && n >= 0 && n <= MAX_SCORE ? n : -1;
  }
</script>

<div class="flex flex-row items-end gap-3">
  <div class="flex flex-1 flex-col gap-2">
    <Label for="team1-score-input">{team1Label}</Label>
    <Input
      id="team1-score-input"
      type="number"
      inputmode="numeric"
      min="0"
      max={MAX_SCORE}
      step="1"
      value={team1Score === -1 ? '' : team1Score}
      oninput={(e) => {
        const next = parseScore(e.currentTarget as HTMLInputElement);
        if (next !== team1Score) team1Score = next;
      }}
    />
  </div>
  <div class="pb-2 text-2xl">–</div>
  <div class="flex flex-1 flex-col gap-2">
    <Label for="team2-score-input">{team2Label}</Label>
    <Input
      id="team2-score-input"
      type="number"
      inputmode="numeric"
      min="0"
      max={MAX_SCORE}
      step="1"
      value={team2Score === -1 ? '' : team2Score}
      oninput={(e) => {
        const next = parseScore(e.currentTarget as HTMLInputElement);
        if (next !== team2Score) team2Score = next;
      }}
    />
  </div>
</div>
