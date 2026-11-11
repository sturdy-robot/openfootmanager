"""Write a synthetic World Editor package shaped like the maintainer's mega package (17,098 players,
581 clubs in 42 built-in countries, 7 package countries, 42 leagues + 3 continental group cups,
608 crest assets of about 22 KB). Every value is generated: no real names, ids or data.
usage: python3 -I synth_mega.py <empty output dir>"""
import json
import os
import random
import sys

out = sys.argv[1]
rng = random.Random(1)

CLUBS_PER_COUNTRY = {
    "ENG": 20, "IT": 20, "ES": 20, "RU": 19, "DE": 18, "FR": 18, "PT": 18, "NL": 18, "BE": 18,
    "TR": 18, "PL": 18, "CZ": 16, "NO": 16, "UA": 16, "SE": 16, "RO": 15, "GR": 14, "DK": 14,
    "RS": 14, "CY": 14, "SK": 14, "SI": 14, "KZ": 14, "SCO": 12, "CH": 12, "AT": 12, "HR": 12,
    "HU": 12, "AZ": 12, "FI": 12, "BG": 11, "GI": 11, "XK": 10, "IE": 10, "AM": 10, "BA": 10,
    "GE": 10, "AL": 9, "LV": 9, "LT": 9, "MD": 8, "AD": 8,
}
PACKAGE_COUNTRIES = [
    ("GM", "africa"), ("GP", "central-america"), ("MF", "central-america"), ("YT", "africa"),
    ("GF", "central-america"), ("MQ", "central-america"), ("SX", "central-america"),
]
PLAYERS = int(os.environ.get("SYNTH_PLAYERS", 17_098))
ASSETS = int(os.environ.get("SYNTH_ASSETS", 608))
if os.environ.get("SYNTH_COUNTRIES"):
    CLUBS_PER_COUNTRY = dict(list(CLUBS_PER_COUNTRY.items())[: int(os.environ["SYNTH_COUNTRIES"])])
SPECIFIC = ["CenterBack", "RightBack", "LeftBack", "DefensiveMidfielder", "CentralMidfielder",
            "AttackingMidfielder", "RightWinger", "LeftWinger", "Striker"]
ATTRIBUTES = ["pace", "stamina", "strength", "agility", "passing", "shooting", "tackling",
              "dribbling", "defending", "positioning", "vision", "decisions", "composure",
              "aggression", "teamwork", "leadership", "handling", "reflexes", "aerial"]
SYLLABLES = ["ka", "lo", "mi", "ra", "ten", "vor", "sel", "dan", "ri", "tos", "bel", "nor", "ze"]


def word(parts):
    return "".join(rng.choice(SYLLABLES) for _ in range(parts)).capitalize()


def write(path, value):
    full = os.path.join(out, path)
    os.makedirs(os.path.dirname(full) or out, exist_ok=True)
    with open(full, "w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, ensure_ascii=False)


assert not os.listdir(out) if os.path.isdir(out) else True, "output dir must be empty"
os.makedirs(out, exist_ok=True)

write("package.json", {
    "schema": "world", "id": "synthetic-mega", "name": "Synthetic Mega", "version": "1.0.0",
    "license": "CC0-1.0", "author": "perf", "description": "synthetic", "formatVersion": 1,
    "gameMinVersion": "0.3.0", "packageType": "database", "baseYear": 2026,
    "defaultActiveCompetitions": [], "defaultActiveRegions": [], "logo": "assets/images/logo.webp",
})
write("confederations/confederations.json", {"schema": "confederation", "items": []})
write("staff/staff.json", {"schema": "staff", "items": []})
write("names/names.json", {"schema": "names", "version": 1, "description": "", "pools": {}})
write("countries/countries.json", {"schema": "country", "items": [
    {"id": code, "name": f"Country {code}", "confederation": confed} for code, confed in PACKAGE_COUNTRIES
]})

teams = []
for country, count in CLUBS_PER_COUNTRY.items():
    for index in range(count):
        club_id = f"club-{country.lower()}-{index:02d}"
        reputation = rng.randint(150, 850)
        teams.append({
            "id": club_id, "name": f"{word(3)} {word(2)}", "shortName": club_id[-6:].upper(),
            "city": word(3), "country": country,
            "colors": {"primary": f"#{rng.randrange(16**6):06x}", "secondary": f"#{rng.randrange(16**6):06x}"},
            "playStyle": rng.choice(["Balanced", "Attacking", "Defensive", "Possession", "Counter", "HighPress"]),
            "reputationRange": [reputation, reputation + 50],
            "financeRange": [reputation * 400_000, reputation * 800_000],
            "kitPattern": rng.choice(["Plain", "Stripes", "Hoops"]), "foundedYear": rng.randint(1870, 1990),
            "logo": f"assets/images/{club_id}.webp",
        })
write("teams/teams.json", {"schema": "team", "items": teams})

squads = {team["id"]: 22 for team in teams}
while sum(squads.values()) < PLAYERS:
    club = rng.choice(teams)["id"]
    if squads[club] < 30:
        squads[club] += 1
country_of = {team["id"]: team["country"] for team in teams}
players = []
for club, size in squads.items():
    for slot in range(size):
        # Goalkeepers carry no weak foot or alternates (as in the real package, where the 2,042
        # players without a weak foot are about the keepers); outfielders have specific positions,
        # since identity fields on a general group are rejected.
        keeper = slot < 3
        position = "Goalkeeper" if keeper else rng.choice(SPECIFIC)
        first, last = word(2), word(3)
        player = {
            "id": f"p-{len(players):06d}", "name": f"{first} {last}", "firstName": first, "lastName": last,
            "club": club, "position": position,
            "dateOfBirth": f"{rng.randint(1988, 2009)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
            "attributes": {name: rng.randint(25, 75) for name in ATTRIBUTES},
            "potential": rng.randint(76, 95), "contractLength": rng.randint(1, 5),
            "value": rng.randint(100_000, 90_000_000), "wage": rng.randint(1_000, 400_000),
            "footedness": rng.choice(["Right", "Right", "Left", "Both"]),
        }
        if rng.random() < 0.998:
            player["nationality"] = country_of[club] if rng.random() < 0.8 else rng.choice(list(CLUBS_PER_COUNTRY))
        if not keeper:
            player["weakFoot"] = rng.randint(1, 5)
            if rng.random() < 0.5:
                others = [p for p in SPECIFIC if p != position]
                player["alternatePositions"] = rng.sample(others, rng.choice([1, 2]))
        players.append(player)
write("players/players.json", {"schema": "player", "items": players})

by_country = {}
for team in teams:
    by_country.setdefault(team["country"], []).append(team)
cups = ["cup-champions", "cup-europa", "cup-conference"]
ranked = sorted(teams, key=lambda team: -team["reputationRange"][0])
competitions = []
for country, clubs in by_country.items():
    berths = []
    for number, cup in enumerate(cups[: rng.choice([0, 1, 2, 3, 3])]):
        berths.append({"target": cup, "rule": {"kind": "positionRange", "from": number * 2 + 1, "to": number * 2 + 2}})
    competitions.append({
        "id": f"league-{country.lower()}", "name": f"League {country}", "type": "League", "scope": "Domestic",
        "regionId": "europe", "countryId": country, "priority": 10, "format": {"kind": "LeagueTable", "legs": 2},
        "participants": {"explicit": [club["id"] for club in clubs]}, "seasonStartMonth": 8,
        "seasonStartDay": 22, "logo": f"assets/images/league-{country.lower()}.webp", "berths": berths,
    })
for index, cup in enumerate(cups):
    competitions.append({
        "id": cup, "name": cup, "type": "ContinentalClub", "scope": "Continental", "regionId": "europe",
        "priority": 10, "format": {"kind": "GroupAndKnockout", "groupSize": 18, "legs": 1, "qualifiersPerGroup": 16},
        "participants": {"explicit": [club["id"] for club in ranked[index * 36:(index + 1) * 36]]},
        "seasonStartMonth": 9, "seasonStartDay": 30, "logo": f"assets/images/{cup}.webp",
    })
write("competitions/competitions.json", {"schema": "competition", "items": competitions})

asset_names = [team["logo"] for team in teams] + [c["logo"] for c in competitions] + ["assets/images/logo.webp"]
asset_names += [f"assets/images/extra-{n}.webp" for n in range(ASSETS - len(asset_names))]
for name in asset_names[:ASSETS]:
    full = os.path.join(out, name)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as handle:
        handle.write(rng.randbytes(rng.randint(8_000, 36_000)))

total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(out) for f in fs)
print(f"SYNTH teams={len(teams)} players={len(players)} competitions={len(competitions)} "
      f"assets={min(ASSETS, len(asset_names))} bytes={total} "
      f"players_json={os.path.getsize(os.path.join(out, 'players/players.json'))}")
