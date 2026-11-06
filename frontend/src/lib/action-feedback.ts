export function parseActionSuccessKey<
  const Messages extends Readonly<Record<string, string>>,
>(
  value: unknown,
  messages: Messages
): Extract<keyof Messages, string> | undefined {
  if (typeof value !== 'string' || !Object.hasOwn(messages, value)) return;
  return value as Extract<keyof Messages, string>;
}
