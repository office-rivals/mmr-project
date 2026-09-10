# RFID team assignment endpoint

This document describes the HTTP contract the Randomizer Box uses to turn an
ordered set of paired RFID tags into two team assignments. The endpoint is
stateless: it does not create a match, update the queue, reserve players, or
modify any database state.

## Endpoint

```http
POST /api/v3/organizations/{orgId}/leagues/{leagueId}/matchmaking/rfid
```

`orgId` and `leagueId` are GUIDs.

## Authentication and headers

The hardware should use a write-scoped Personal Access Token (PAT) authorized
for the organization and league:

```http
Authorization: Bearer pat_<token>
Content-Type: application/json
Accept: application/json
```

An ordinary authenticated user session can also call the endpoint. The PAT is
the expected credential for hardware. Do not log or display the PAT.

## Request body

```json
{
  "rfidUids": ["A", "B", "C", "D"],
  "temperature": 0
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `rfidUids` | string array | Yes | RFID UIDs in the order the box wants them assigned. The count must be exactly `league.teamSize * 2`. |
| `temperature` | number | No | Inclusive range `0` to `1`; omitted means `0`. Controls how much the result favors randomness over MMR balance. |

The current API supports team sizes 1 and 2:

| League | Required RFID count |
| --- | ---: |
| 1v1 | 2 |
| 2v2 | 4 |

RFID UIDs are trimmed at both ends before lookup, then matched exactly. Matching
is case-sensitive. Empty or duplicate UIDs are rejected.

## Successful response

The response is a JSON array, not an object wrapper:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
[0, 1, 1, 0]
```

The response has the same length and order as `rfidUids`:

```text
rfidUids: [ A, B, C, D ]
result:   [ 0, 1, 1, 0 ]
          |  |  |  |
          A  B  C  D
```

Each result value is a team side:

- `0` = white
- `1` = red

There must be exactly `teamSize` values of each side.

## Assignment behavior

The server:

1. Resolves every RFID UID to its paired user.
2. Confirms every user is an active player in the requested league.
3. Generates every unique, equal-sized two-team split.
4. Scores each split by the absolute difference between the two teams' summed MMR.
5. Selects a split according to `temperature`.

Mirrored splits are treated as the same split. To remove that duplicate, the
first RFID in the request is always assigned to side `0`. Therefore, with a 1v1
request, the result is always `[0, 1]`.

For four players, the legal split shapes are:

```text
[0, 0, 1, 1]
[0, 1, 0, 1]
[0, 1, 1, 0]
```

Temperature selection is probabilistic:

- `0`: choose randomly among the MMR-best splits. If several splits have the
  same MMR difference, this is how ties are randomized.
- `1`: choose uniformly from all legal splits.
- Between `0` and `1`: choose an MMR-best split with probability
  `1 - temperature`, otherwise choose any legal split.

For example, `temperature: 0.25` gives approximately a 75% chance of an
MMR-best split and a 25% chance of any legal split.

## Errors

Application validation errors use the API's Problem Details shape:

```json
{
  "title": "Bad Request",
  "status": 400,
  "detail": "..."
}
```

| Status | Meaning |
| ---: | --- |
| `400` | Malformed JSON, missing/invalid fields, wrong RFID count, temperature outside `0..1`, empty/duplicate UIDs, or multiple tags belonging to the same player. |
| `401` | Missing, invalid, or expired authentication. |
| `403` | The credential does not have access to the organization or league, or a PAT does not have write scope. |
| `404` | The league does not exist, an RFID UID is unknown, or an RFID owner is not an active player in the requested league. |

## Firmware flow and retries

1. Collect RFID tags in the desired input order.
2. Send one POST request with the complete array.
3. On `200`, parse the root JSON array and apply each result at the matching
   input position.
4. On `400` or `404`, do not retry the unchanged request; correct the input or
   re-pair the tag.
5. On `401` or `403`, stop assignment and report a credential/access problem.
6. Network failures and `5xx` responses can be retried with backoff. Since the
   endpoint is stateless, retrying does not create duplicate matches. With a
   temperature above `0`, a retry may legitimately return a different valid
   assignment.
