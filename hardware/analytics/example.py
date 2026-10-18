"""Reference calculation for METRICS.md: runs the worked example through the recommended metrics.

Stdlib only. `python3 example.py` prints the numbers quoted in METRICS.md §7 and asserts the
invariants the formulas promise (contributions sum to the goal difference, WPA sums to result minus
expectation, ...). Backend can port these functions one to one.
"""
from math import comb, erf, sqrt
from statistics import median

W = 10                      # league WinningScore
BETA2 = (25 / 6) ** 2       # OpenSkill beta^2 with default mu=25, sigma=25/3 (rating/predict.go)

# Pre-match ratings (mu, sigma), from each player's RatingHistory row before this match.
RATING = {"Alice": (27.0, 3.0), "Bob": (24.0, 4.0), "Carol": (28.0, 3.0), "Dave": (26.0, 3.5)}
TEAMS = {"A": ["Alice", "Bob"], "B": ["Carol", "Dave"]}   # end A = MatchTeam index 0

# (event time in s after the first goal, team credited (ScoringEnd), scorer or None, undone)
GOALS = [
    (0, "B", "Carol", False), (38, "B", "Dave", False), (40, "B", None, True),   # 40: double count, undone
    (71, "A", "Alice", False), (95, "B", "Carol", False), (130, "B", "Carol", False),
    (152, "B", None, False), (201, "A", "Bob", False), (236, "A", "Dave", False),  # 236: Dave's own goal
    (260, "A", "Alice", False), (301, "B", "Dave", False), (322, "A", "Alice", False),
    (344, "A", "Alice", False), (379, "A", None, False), (421, "B", "Carol", False),
    (450, "B", "Carol", False), (482, "A", "Bob", False), (503, "A", "Alice", False),
    (540, "B", "Dave", False), (566, "A", "Bob", False),
]


def other(team):
    return "B" if team == "A" else "A"


def team_of(player):
    return next(t for t, ps in TEAMS.items() if player in ps)


def is_own_goal(team, scorer):
    return scorer is not None and team_of(scorer) != team


def phi(x):
    return 0.5 * (1 + erf(x / sqrt(2)))


def predict_win_a():
    """OpenSkill PredictWin for two teams: Phi((muA - muB) / sqrt(2 beta^2 + sigmaA^2 + sigmaB^2))."""
    mu = {t: sum(RATING[p][0] for p in ps) for t, ps in TEAMS.items()}
    s2 = {t: sum(RATING[p][1] ** 2 for p in ps) for t, ps in TEAMS.items()}
    return phi((mu["A"] - mu["B"]) / sqrt(2 * BETA2 + s2["A"] + s2["B"]))


def race_win(a, b, p):
    """P(team A reaches W first from a:b) when each goal is A's with probability p."""
    if a >= W:
        return 1.0
    if b >= W:
        return 0.0
    na, nb = W - a, W - b
    return sum(comb(na - 1 + k, k) * p ** na * (1 - p) ** k for k in range(nb))


def goal_prob_a(win_a):
    """The per-goal probability p that makes race_win(0, 0, p) equal the pre-match win probability."""
    lo, hi = 1e-6, 1 - 1e-6
    for _ in range(60):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if race_win(0, 0, mid) < win_a else (lo, mid)
    return (lo + hi) / 2


def analyse():
    counted = sorted(g for g in GOALS if not g[3])
    n = len(counted)
    times = [g[0] for g in counted]
    gaps = [b - a for a, b in zip(times, times[1:])]

    # Score flow
    a = b = 0
    flow, leader, lead_changes, ties, runs = [], None, 0, 0, []
    run_team, run_len = None, 0
    max_deficit = {"A": 0, "B": 0}
    lead_time = {"A": 0, "B": 0, "tie": 0}
    for i, (t, team, scorer, _) in enumerate(counted):
        if i:
            state = "tie" if a == b else ("A" if a > b else "B")
            lead_time[state] += t - counted[i - 1][0]
        a, b = (a + 1, b) if team == "A" else (a, b + 1)
        flow.append((a, b))
        max_deficit["A"] = max(max_deficit["A"], b - a)
        max_deficit["B"] = max(max_deficit["B"], a - b)
        if a == b:
            ties += 1
        else:
            now = "A" if a > b else "B"
            if leader is not None and now != leader:
                lead_changes += 1
            leader = now
        run_len = run_len + 1 if team == run_team else 1
        run_team = team
        runs.append((run_team, run_len))
    winner = "A" if a > b else "B"

    # Win probability and WPA (per goal, for the team credited)
    p0 = predict_win_a()
    p = goal_prob_a(p0)
    wp, sa, sb, wpa, excitement = [p0], 0, 0, [], 0.0
    for t, team, scorer, _ in counted:
        before = race_win(sa, sb, p)
        sa, sb = (sa + 1, sb) if team == "A" else (sa, sb + 1)
        after = race_win(sa, sb, p)
        wp.append(after)
        excitement += abs(after - before)
        wpa.append(abs(after - before))         # value of the goal for the team credited

    # Contribution (v = 1) and impact (v = WPA)
    def credit(values):
        c = {pl: 0.0 for ps in TEAMS.values() for pl in ps}
        for (t, team, scorer, _), v in zip(counted, values):
            for_team, against = TEAMS[team], TEAMS[other(team)]
            if scorer is not None and not is_own_goal(team, scorer):
                c[scorer] += v                                      # scored it
            else:
                for pl in for_team:                                 # unknown scorer, or opponent's own goal
                    c[pl] += v / len(for_team)
            if is_own_goal(team, scorer):
                c[scorer] -= v                                      # own goal: all on the player
            else:
                for pl in against:                                  # conceded: shared
                    c[pl] -= v / len(against)
        return c

    contribution = credit([1.0] * n)
    impact = credit(wpa)
    coverage = {}
    for team in TEAMS:
        mine = [g for g in counted if g[1] == team]
        coverage[team] = sum(g[2] is not None for g in mine) / len(mine)

    # Invariants the doc relies on
    for team, ps in TEAMS.items():
        gd = sum(1 if f[1] == team else -1 for f in counted)
        assert abs(sum(contribution[pl] for pl in ps) - gd) < 1e-9
        result = 1.0 if team == winner else 0.0
        exp = p0 if team == "A" else 1 - p0
        assert abs(sum(impact[pl] for pl in ps) - (result - exp)) < 1e-9
    assert sum(lead_time.values()) == times[-1] - times[0]
    assert flow[-1] == (10, 9) and n == 19

    return dict(n=n, span=times[-1] - times[0], gaps=gaps, flow=flow, lead_changes=lead_changes, ties=ties,
                runs=runs, max_deficit=max_deficit, lead_time=lead_time, winner=winner, p0=p0, p=p, wp=wp,
                excitement=excitement, contribution=contribution, impact=impact, coverage=coverage,
                gsoe={"A": flow[-1][0] / n - p, "B": flow[-1][1] / n - (1 - p)})


if __name__ == "__main__":
    r = analyse()
    span = r["span"]
    print(f"goals counted {r['n']} (1 undone), span {span} s = {span // 60}:{span % 60:02d}")
    print(f"pace {span / (r['n'] - 1):.1f} s/goal, median gap {median(r['gaps'])} s, "
          f"longest drought {max(r['gaps'])} s, shortest gap {min(r['gaps'])} s")
    print("flow", " ".join(f"{a}:{b}" for a, b in r["flow"]))
    print(f"lead changes {r['lead_changes']}, ties {r['ties']}, max deficits {r['max_deficit']}")
    print("longest run", max(r["runs"], key=lambda x: x[1]), "lead time", r["lead_time"],
          {k: f"{v / span:.1%}" for k, v in r["lead_time"].items()})
    print(f"pre-match P(A wins) {r['p0']:.3f}, per-goal p(A) {r['p']:.4f}, expected goal share A {r['p']:.3f}")
    print("WP(A) after each goal", " ".join(f"{x:.2f}" for x in r["wp"]))
    print(f"min WP of winner {min(r['wp']):.3f}, excitement {r['excitement']:.2f}")
    print("goal share over expected", {k: f"{v:+.3f}" for k, v in r["gsoe"].items()})
    print("scorer coverage", {k: f"{v:.0%}" for k, v in r["coverage"].items()})
    print("contribution", {k: round(v, 2) for k, v in r["contribution"].items()})
    print("impact (WPA)", {k: round(v, 3) for k, v in r["impact"].items()})
