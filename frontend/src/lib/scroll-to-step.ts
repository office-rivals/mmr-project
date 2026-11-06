export function scrollToStep(id: string) {
  // Router hash navigation reloads shell data and can discard the form in progress.
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
}
