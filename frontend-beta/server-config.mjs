import { isIP } from 'node:net';

export function parseTrustProxy(value) {
  const normalized = value?.trim();
  if (normalized === undefined || normalized === '' || normalized === 'false') {
    return false;
  }
  if (normalized === 'true') return true;
  if (normalized === 'loopback') return 'loopback';

  const addresses = normalized.split(',').map((entry) => entry.trim());
  if (addresses.some((address) => address === '' || isIP(address) === 0)) {
    throw new Error(
      'TRUST_PROXY must be false, true, loopback, or a comma-separated list of IP addresses'
    );
  }
  return addresses;
}
