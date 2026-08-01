type NotPresent = undefined | null | void;

export function isPresent<T>(t: T | NotPresent): t is T {
  return t !== undefined && t !== null;
}

export function isDefined<T>(t: T | undefined): t is T {
  return t !== undefined;
}

export function isNotNull<T>(t: T | null): t is T {
  return t !== null;
}
