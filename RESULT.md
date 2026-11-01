Cloud run r3-1078-gen1-1: DONE

## Setup
- `apt-get update && apt-get install` of the four webkit/gtk packages: exit 0.
- Rust 1.95.0 (pinned in rust-toolchain.toml) was already installed. `npm ci`: exit 0.
- Started on ae5e94e7c56fd180c0873c07b9d51d42fc54c577.

## Step 1: refs
- pr-1078 HEAD: `22bdef7856e2485002d620a6bd57acb3f485b35a` (feat(generator): a club's players are rolled around its reputation, the free-agent pool below it (#869))
- dev-ref (develop) HEAD: `3005253ed1b31c78734d95a715ac6d390d441b49`
- BASE = `git merge-base pr-1078 dev-ref` = `3005253ed1b31c78734d95a715ac6d390d441b49`. BASE is develop's tip; the PR is 2 commits ahead of it.
- Each checkout was verified by `git rev-parse HEAD` before its runs. `ofm_core` recompiled on both.

## Step 2: commands (all `--release`, `--test-threads=1`)
| step | BASE | PR |
|---|---|---|
| 2a measure_distribution | exit 0, 1 passed, 193.41s | exit 0, 1 passed, 173.04s |
| 2b generated_concentration | skipped: the file does not exist on BASE | exit 0, **4 passed** 0 failed, 3.44s |
| 2c measure_reputation | exit 0, 1 passed, 1073.96s | exit 0, 1 passed, 1085.23s |

No run reached the 45-minute cap.

### 2a comparison (BASE → PR)

**gate world, seed 1**

| row | mean ovr | ovr S % | ovr A % | ceiling S % | wonderkids % |
|---|---|---|---|---|---|
| opening | 69.7 → 69.0 | 2.4% → 1.9% | 9.8% → 6.5% | 3.0% → 2.2% | 0.3% → 0.1% |
| season 1 | 69.2 → 68.6 | 2.2% → 1.4% | 8.1% → 6.3% | 2.7% → 1.7% | 0.2% → 0.2% |
| season 2 | 68.9 → 68.4 | 1.9% → 1.2% | 6.9% → 6.4% | 2.4% → 1.4% | 0.1% → 0.1% |
| season 3 | 68.8 → 68.1 | 1.5% → 1.0% | 6.9% → 5.4% | 1.9% → 1.2% | 0.0% → 0.0% |
| season 4 | 68.6 → 67.9 | 1.4% → 0.8% | 6.4% → 5.2% | 1.8% → 1.0% | 0.1% → 0.0% |
| season 5 | 68.5 → 67.8 | 1.3% → 0.8% | 6.0% → 5.5% | 1.7% → 1.0% | 0.1% → 0.1% |

**gate world, seed 2**

| row | mean ovr | ovr S % | ovr A % | ceiling S % | wonderkids % |
|---|---|---|---|---|---|
| opening | 69.7 → 69.1 | 2.5% → 2.3% | 9.4% → 7.5% | 3.1% → 2.9% | 0.2% → 0.1% |
| season 1 | 69.1 → 68.7 | 1.9% → 1.9% | 7.5% → 6.2% | 2.6% → 2.5% | 0.1% → 0.2% |
| season 2 | 68.5 → 68.3 | 1.5% → 1.6% | 6.9% → 6.0% | 2.3% → 2.2% | 0.1% → 0.2% |
| season 3 | 68.5 → 68.0 | 1.5% → 1.2% | 7.3% → 5.4% | 2.1% → 1.7% | 0.1% → 0.1% |
| season 4 | 68.2 → 67.8 | 1.3% → 1.0% | 6.5% → 5.0% | 1.8% → 1.3% | 0.2% → 0.2% |
| season 5 | 68.2 → 67.7 | 1.2% → 0.7% | 5.8% → 5.2% | 1.7% → 1.0% | 0.1% → 0.1% |

**gate world, seed 3**

| row | mean ovr | ovr S % | ovr A % | ceiling S % | wonderkids % |
|---|---|---|---|---|---|
| opening | 69.7 → 69.2 | 2.4% → 2.0% | 10.0% → 8.3% | 2.9% → 2.4% | 0.3% → 0.3% |
| season 1 | 69.2 → 68.8 | 1.8% → 1.6% | 8.6% → 7.2% | 2.4% → 2.0% | 0.1% → 0.1% |
| season 2 | 68.9 → 68.5 | 1.7% → 1.3% | 7.9% → 6.7% | 2.1% → 1.6% | 0.1% → 0.1% |
| season 3 | 68.8 → 68.2 | 1.7% → 0.9% | 7.3% → 6.2% | 2.2% → 1.1% | 0.2% → 0.2% |
| season 4 | 68.5 → 68.0 | 1.5% → 0.8% | 6.5% → 5.8% | 1.8% → 1.0% | 0.2% → 0.2% |
| season 5 | 68.4 → 67.9 | 1.3% → 0.8% | 5.9% → 5.5% | 1.7% → 1.0% | 0.1% → 0.0% |

**shipped world, seed 1**

| row | mean ovr | ovr S % | ovr A % | ceiling S % | wonderkids % |
|---|---|---|---|---|---|
| opening | 69.6 → 69.7 | 2.1% → 2.4% | 9.8% → 9.6% | 2.7% → 2.9% | 0.3% → 0.2% |
| season 1 | 69.2 → 69.3 | 1.7% → 2.0% | 8.1% → 8.3% | 2.3% → 2.5% | 0.3% → 0.3% |
| season 2 | 69.0 → 69.1 | 1.4% → 1.7% | 7.6% → 7.5% | 1.9% → 2.1% | 0.2% → 0.2% |
| season 3 | 69.0 → 69.0 | 1.4% → 1.5% | 7.5% → 6.9% | 1.8% → 1.7% | 0.1% → 0.1% |
| season 4 | 68.9 → 69.0 | 1.3% → 1.3% | 6.9% → 6.5% | 1.6% → 1.5% | 0.1% → 0.1% |
| season 5 | 68.9 → 69.0 | 1.3% → 1.1% | 6.6% → 6.3% | 1.5% → 1.3% | 0.1% → 0.1% |

### 2a verbatim, BASE
```
test the_player_distribution_over_five_seasons ... gate world, seed 1
   opening | players   3744 seniors   2587 | mean ovr  69.7 | ovr S   2.4% A   9.8% | ceiling S   3.0% A  12.3% | <21  30.9% | wonderkids   0.3%
  season 1 | players   3742 seniors   2551 | mean ovr  69.2 | ovr S   2.2% A   8.1% | ceiling S   2.7% A  10.6% | <21  31.8% | wonderkids   0.2%
  season 2 | players   3636 seniors   2560 | mean ovr  68.9 | ovr S   1.9% A   6.9% | ceiling S   2.4% A   9.6% | <21  29.6% | wonderkids   0.1%
  season 3 | players   4033 seniors   3014 | mean ovr  68.8 | ovr S   1.5% A   6.9% | ceiling S   1.9% A   9.5% | <21  25.3% | wonderkids   0.0%
  season 4 | players   4048 seniors   3157 | mean ovr  68.6 | ovr S   1.4% A   6.4% | ceiling S   1.8% A   8.6% | <21  22.0% | wonderkids   0.1%
  season 5 | players   3993 seniors   3188 | mean ovr  68.5 | ovr S   1.3% A   6.0% | ceiling S   1.7% A   7.8% | <21  20.2% | wonderkids   0.1%
gate world, seed 2
   opening | players   3632 seniors   2485 | mean ovr  69.7 | ovr S   2.5% A   9.4% | ceiling S   3.1% A  11.8% | <21  31.6% | wonderkids   0.2%
  season 1 | players   3650 seniors   2457 | mean ovr  69.1 | ovr S   1.9% A   7.5% | ceiling S   2.6% A   9.6% | <21  32.7% | wonderkids   0.1%
  season 2 | players   3523 seniors   2476 | mean ovr  68.5 | ovr S   1.5% A   6.9% | ceiling S   2.3% A   9.2% | <21  29.7% | wonderkids   0.1%
  season 3 | players   3928 seniors   2883 | mean ovr  68.5 | ovr S   1.5% A   7.3% | ceiling S   2.1% A   9.3% | <21  26.6% | wonderkids   0.1%
  season 4 | players   3959 seniors   3050 | mean ovr  68.2 | ovr S   1.3% A   6.5% | ceiling S   1.8% A   8.3% | <21  23.0% | wonderkids   0.2%
  season 5 | players   3884 seniors   3092 | mean ovr  68.2 | ovr S   1.2% A   5.8% | ceiling S   1.7% A   7.2% | <21  20.4% | wonderkids   0.1%
gate world, seed 3
   opening | players   3563 seniors   2444 | mean ovr  69.7 | ovr S   2.4% A  10.0% | ceiling S   2.9% A  12.0% | <21  31.4% | wonderkids   0.3%
  season 1 | players   3595 seniors   2413 | mean ovr  69.2 | ovr S   1.8% A   8.6% | ceiling S   2.4% A  10.4% | <21  32.9% | wonderkids   0.1%
  season 2 | players   3510 seniors   2431 | mean ovr  68.9 | ovr S   1.7% A   7.9% | ceiling S   2.1% A  10.0% | <21  30.7% | wonderkids   0.1%
  season 3 | players   3801 seniors   2767 | mean ovr  68.8 | ovr S   1.7% A   7.3% | ceiling S   2.2% A   9.3% | <21  27.2% | wonderkids   0.2%
  season 4 | players   3829 seniors   2926 | mean ovr  68.5 | ovr S   1.5% A   6.5% | ceiling S   1.8% A   8.6% | <21  23.6% | wonderkids   0.2%
  season 5 | players   3794 seniors   2979 | mean ovr  68.4 | ovr S   1.3% A   5.9% | ceiling S   1.7% A   7.9% | <21  21.5% | wonderkids   0.1%
shipped world, seed 1
   opening | players  13915 seniors   9120 | mean ovr  69.6 | ovr S   2.1% A   9.8% | ceiling S   2.7% A  12.3% | <21  34.5% | wonderkids   0.3%
  season 1 | players  14369 seniors   9089 | mean ovr  69.2 | ovr S   1.7% A   8.1% | ceiling S   2.3% A  10.6% | <21  36.7% | wonderkids   0.3%
  season 2 | players  14269 seniors   9285 | mean ovr  69.0 | ovr S   1.4% A   7.6% | ceiling S   1.9% A   9.9% | <21  34.9% | wonderkids   0.2%
  season 3 | players  14575 seniors   9955 | mean ovr  69.0 | ovr S   1.4% A   7.5% | ceiling S   1.8% A   9.3% | <21  31.7% | wonderkids   0.1%
  season 4 | players  14639 seniors  10525 | mean ovr  68.9 | ovr S   1.3% A   6.9% | ceiling S   1.6% A   8.6% | <21  28.1% | wonderkids   0.1%
  season 5 | players  14634 seniors  10837 | mean ovr  68.9 | ovr S   1.3% A   6.6% | ceiling S   1.5% A   7.8% | <21  25.9% | wonderkids   0.1%
```
### 2a verbatim, PR
```
test the_player_distribution_over_five_seasons ... gate world, seed 1
   opening | players   3744 seniors   2587 | mean ovr  69.0 | ovr S   1.9% A   6.5% | ceiling S   2.2% A   9.0% | <21  30.9% | wonderkids   0.1%
  season 1 | players   3743 seniors   2552 | mean ovr  68.6 | ovr S   1.4% A   6.3% | ceiling S   1.7% A   8.9% | <21  31.8% | wonderkids   0.2%
  season 2 | players   3632 seniors   2562 | mean ovr  68.4 | ovr S   1.2% A   6.4% | ceiling S   1.4% A   8.7% | <21  29.5% | wonderkids   0.1%
  season 3 | players   4017 seniors   2989 | mean ovr  68.1 | ovr S   1.0% A   5.4% | ceiling S   1.2% A   7.2% | <21  25.6% | wonderkids   0.0%
  season 4 | players   4039 seniors   3136 | mean ovr  67.9 | ovr S   0.8% A   5.2% | ceiling S   1.0% A   6.8% | <21  22.4% | wonderkids   0.0%
  season 5 | players   3995 seniors   3191 | mean ovr  67.8 | ovr S   0.8% A   5.5% | ceiling S   1.0% A   6.4% | <21  20.1% | wonderkids   0.1%
gate world, seed 2
   opening | players   3632 seniors   2485 | mean ovr  69.1 | ovr S   2.3% A   7.5% | ceiling S   2.9% A   9.3% | <21  31.6% | wonderkids   0.1%
  season 1 | players   3640 seniors   2450 | mean ovr  68.7 | ovr S   1.9% A   6.2% | ceiling S   2.5% A   8.0% | <21  32.7% | wonderkids   0.2%
  season 2 | players   3508 seniors   2468 | mean ovr  68.3 | ovr S   1.6% A   6.0% | ceiling S   2.2% A   7.6% | <21  29.6% | wonderkids   0.2%
  season 3 | players   3922 seniors   2879 | mean ovr  68.0 | ovr S   1.2% A   5.4% | ceiling S   1.7% A   6.5% | <21  26.6% | wonderkids   0.1%
  season 4 | players   3952 seniors   3049 | mean ovr  67.8 | ovr S   1.0% A   5.0% | ceiling S   1.3% A   5.8% | <21  22.8% | wonderkids   0.2%
  season 5 | players   3865 seniors   3082 | mean ovr  67.7 | ovr S   0.7% A   5.2% | ceiling S   1.0% A   5.9% | <21  20.3% | wonderkids   0.1%
gate world, seed 3
   opening | players   3563 seniors   2444 | mean ovr  69.2 | ovr S   2.0% A   8.3% | ceiling S   2.4% A  10.6% | <21  31.4% | wonderkids   0.3%
  season 1 | players   3596 seniors   2412 | mean ovr  68.8 | ovr S   1.6% A   7.2% | ceiling S   2.0% A   9.4% | <21  32.9% | wonderkids   0.1%
  season 2 | players   3506 seniors   2432 | mean ovr  68.5 | ovr S   1.3% A   6.7% | ceiling S   1.6% A   9.0% | <21  30.6% | wonderkids   0.1%
  season 3 | players   3808 seniors   2777 | mean ovr  68.2 | ovr S   0.9% A   6.2% | ceiling S   1.1% A   7.7% | <21  27.1% | wonderkids   0.2%
  season 4 | players   3835 seniors   2938 | mean ovr  68.0 | ovr S   0.8% A   5.8% | ceiling S   1.0% A   7.0% | <21  23.4% | wonderkids   0.2%
  season 5 | players   3805 seniors   3000 | mean ovr  67.9 | ovr S   0.8% A   5.5% | ceiling S   1.0% A   6.3% | <21  21.2% | wonderkids   0.0%
shipped world, seed 1
   opening | players  13915 seniors   9120 | mean ovr  69.7 | ovr S   2.4% A   9.6% | ceiling S   2.9% A  12.1% | <21  34.5% | wonderkids   0.2%
  season 1 | players  14356 seniors   9076 | mean ovr  69.3 | ovr S   2.0% A   8.3% | ceiling S   2.5% A  10.5% | <21  36.8% | wonderkids   0.3%
  season 2 | players  14249 seniors   9277 | mean ovr  69.1 | ovr S   1.7% A   7.5% | ceiling S   2.1% A   9.6% | <21  34.9% | wonderkids   0.2%
  season 3 | players  14554 seniors   9947 | mean ovr  69.0 | ovr S   1.5% A   6.9% | ceiling S   1.7% A   8.6% | <21  31.7% | wonderkids   0.1%
  season 4 | players  14617 seniors  10524 | mean ovr  69.0 | ovr S   1.3% A   6.5% | ceiling S   1.5% A   7.8% | <21  28.0% | wonderkids   0.1%
  season 5 | players  14616 seniors  10844 | mean ovr  69.0 | ovr S   1.1% A   6.3% | ceiling S   1.3% A   7.3% | <21  25.8% | wonderkids   0.1%
```

## 2b generated_concentration (PR only)
Pass: `a_higher_reputation_fifth_has_a_better_first_team_at_opening`, `the_free_agents_are_mostly_ordinary_at_opening`, `the_top_fifth_of_clubs_holds_half_of_the_stars_at_opening`, `the_worlds_tiers_and_mean_are_unchanged_at_opening`. Each of the 4 tests printed the same 2 OPENING lines; they are shown once here:
```
OPENING seed 1: fifths (lowest first): [S 0.9% A 4.3% ovr 69.2; S 6.4% A 9.0% ovr 71.4; S 9.5% A 17.3% ovr 73.0; S 20.0% A 26.5% ovr 74.5; S 62.3% A 38.6% ovr 76.4]; free agents S 0.9% A 4.3%; world S 2.41% A 9.64% mean 69.65 wonderkids 0.23%
OPENING seed 2: fifths (lowest first): [S 0.8% A 3.8% ovr 69.0; S 5.0% A 10.6% ovr 71.2; S 8.9% A 15.7% ovr 73.0; S 27.0% A 25.5% ovr 74.7; S 57.5% A 38.4% ovr 76.4]; free agents S 0.8% A 5.9%; world S 2.82% A 9.41% mean 69.68 wonderkids 0.19%
```

## 2c measure_reputation, full report
### BASE (3005253e)
```
== gate world, seed 1
opening
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    16 |  711 -  862 |      4.8% |      6.7% |   71.1
      2 |    16 |  637 -  704 |     11.3% |      6.3% |   70.8
      3 |    16 |  551 -  634 |      8.1% |      7.1% |   71.4
      4 |    16 |  458 -  541 |      3.2% |      8.7% |   71.6
      5 |    16 |  304 -  457 |      8.1% |      8.3% |   71.6
  no club |       |             |     64.5% |     62.8% |
  tier  1 |    60 clubs | S  29.0% A  27.3% | first-team ovr  71.3
  tier  2 |    20 clubs | S   6.5% A   9.9% | first-team ovr  71.2
after season 10
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    16 |  677 -  867 |     20.0% |     17.9% |   73.7
      2 |    16 |  605 -  665 |     22.9% |     12.1% |   73.3
      3 |    16 |  547 -  604 |      8.6% |      8.7% |   72.4
      4 |    16 |  487 -  546 |     17.1% |     14.5% |   73.4
      5 |    16 |  396 -  483 |     14.3% |      8.1% |   73.1
  no club |       |             |     17.1% |     38.7% |
  tier  1 |    60 clubs | S  71.4% A  48.0% | first-team ovr  73.2
  tier  2 |    20 clubs | S  11.4% A  13.3% | first-team ovr  72.9
== shipped world, seed 1
opening
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    88 |  675 -  875 |     17.2% |     12.8% |   71.9
      2 |    88 |  574 -  674 |     13.0% |     14.7% |   71.9
      3 |    88 |  477 -  572 |     14.6% |     14.6% |   71.9
      4 |    88 |  384 -  477 |     12.0% |     13.6% |   71.5
      5 |    88 |   97 -  381 |     14.1% |     12.4% |   71.6
  no club |       |             |     29.2% |     31.9% |
  tier  1 |   320 clubs | S  55.2% A  48.3% | first-team ovr  71.7
  tier  2 |   120 clubs | S  15.6% A  19.8% | first-team ovr  71.7
after season 5
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    88 |  657 -  874 |     23.1% |     20.9% |   73.0
      2 |    88 |  553 -  657 |     28.7% |     18.8% |   72.9
      3 |    88 |  471 -  552 |     18.2% |     16.8% |   72.5
      4 |    88 |  388 -  471 |     16.8% |     13.6% |   72.4
      5 |    88 |  190 -  388 |     12.6% |     14.2% |   72.3
  no club |       |             |      0.7% |     15.7% |
  tier  1 |   320 clubs | S  71.3% A  65.8% | first-team ovr  72.7
  tier  2 |   120 clubs | S  28.0% A  18.5% | first-team ovr  72.3
after season 10
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    88 |  659 -  872 |     20.2% |     23.8% |   73.4
      2 |    88 |  554 -  656 |     20.2% |     16.5% |   73.2
      3 |    88 |  475 -  553 |     22.7% |     18.5% |   73.0
      4 |    88 |  391 -  474 |     16.8% |     19.1% |   73.0
      5 |    88 |  195 -  388 |     16.0% |     13.8% |   72.7
  no club |       |             |      4.2% |      8.1% |
  tier  1 |   320 clubs | S  71.4% A  69.9% | first-team ovr  73.2
  tier  2 |   120 clubs | S  24.4% A  22.0% | first-team ovr  72.7
after season 20
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    88 |  660 -  872 |     18.4% |     18.8% |   73.0
      2 |    88 |  555 -  659 |     19.3% |     18.7% |   72.9
      3 |    88 |  475 -  554 |     17.5% |     16.1% |   72.7
      4 |    88 |  393 -  475 |     17.5% |     16.1% |   72.6
      5 |    88 |  195 -  391 |     22.8% |     15.9% |   72.6
  no club |       |             |      4.4% |     14.5% |
  tier  1 |   320 clubs | S  70.2% A  63.4% | first-team ovr  72.8
  tier  2 |   120 clubs | S  25.4% A  22.2% | first-team ovr  72.6
```
### PR (22bdef78)
```
== gate world, seed 1
opening
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    16 |  711 -  862 |     47.9% |     31.4% |   76.1
      2 |    16 |  637 -  704 |     25.0% |     22.5% |   74.1
      3 |    16 |  551 -  634 |     12.5% |     17.2% |   73.7
      4 |    16 |  458 -  541 |      8.3% |     11.8% |   72.5
      5 |    16 |  304 -  457 |      6.2% |      3.0% |   70.7
  no club |       |             |      0.0% |     14.2% |
  tier  1 |    60 clubs | S  89.6% A  68.6% | first-team ovr  73.6
  tier  2 |    20 clubs | S  10.4% A  17.2% | first-team ovr  72.8
after season 10
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    16 |  675 -  870 |     55.0% |     26.5% |   75.0
      2 |    16 |  615 -  673 |      0.0% |     30.9% |   74.3
      3 |    16 |  543 -  608 |     15.0% |      9.6% |   73.0
      4 |    16 |  481 -  536 |     25.0% |     15.4% |   73.5
      5 |    16 |  395 -  479 |      0.0% |     12.5% |   72.9
  no club |       |             |      5.0% |      5.1% |
  tier  1 |    60 clubs | S  85.0% A  70.6% | first-team ovr  73.7
  tier  2 |    20 clubs | S  10.0% A  24.3% | first-team ovr  73.9
== shipped world, seed 1
opening
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    88 |  675 -  875 |     62.3% |     38.6% |   76.4
      2 |    88 |  574 -  674 |     20.0% |     26.5% |   74.5
      3 |    88 |  477 -  572 |      9.5% |     17.3% |   73.0
      4 |    88 |  384 -  477 |      6.4% |      9.0% |   71.4
      5 |    88 |   97 -  381 |      0.9% |      4.3% |   69.2
  no club |       |             |      0.9% |      4.3% |
  tier  1 |   320 clubs | S  89.5% A  73.4% | first-team ovr  73.0
  tier  2 |   120 clubs | S   9.5% A  22.3% | first-team ovr  72.5
after season 5
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    88 |  660 -  878 |     55.4% |     33.4% |   75.3
      2 |    88 |  555 -  659 |     21.5% |     28.3% |   74.1
      3 |    88 |  470 -  554 |     14.0% |     22.8% |   73.3
      4 |    88 |  391 -  470 |      8.3% |     10.2% |   72.0
      5 |    88 |  174 -  390 |      0.8% |      5.1% |   70.3
  no club |       |             |      0.0% |      0.1% |
  tier  1 |   320 clubs | S  81.8% A  70.3% | first-team ovr  72.9
  tier  2 |   120 clubs | S  18.2% A  29.5% | first-team ovr  73.3
after season 10
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    88 |  656 -  890 |     39.4% |     33.1% |   74.6
      2 |    88 |  556 -  656 |     20.2% |     24.8% |   74.0
      3 |    88 |  475 -  556 |     22.3% |     15.8% |   73.1
      4 |    88 |  389 -  474 |     10.6% |     16.5% |   72.8
      5 |    88 |  196 -  388 |      7.4% |      8.9% |   71.6
  no club |       |             |      0.0% |      0.9% |
  tier  1 |   320 clubs | S  73.4% A  71.1% | first-team ovr  73.1
  tier  2 |   120 clubs | S  26.6% A  28.0% | first-team ovr  73.5
after season 20
  fifth | clubs | reputation  | S players | A players | first-team ovr
    top |    88 |  663 -  875 |     18.8% |     24.3% |   72.9
      2 |    88 |  557 -  661 |     20.8% |     18.9% |   72.6
      3 |    88 |  476 -  556 |     17.8% |     17.0% |   72.4
      4 |    88 |  389 -  476 |     17.8% |     18.2% |   72.6
      5 |    88 |  195 -  389 |     23.8% |     18.0% |   72.4
  no club |       |             |      1.0% |      3.5% |
  tier  1 |   320 clubs | S  78.2% A  73.2% | first-team ovr  72.7
  tier  2 |   120 clubs | S  20.8% A  23.3% | first-team ovr  72.4
```

Observation, not a verdict: at opening the PR moves the shipped world's top-fifth share from S 17.2% / A 12.8% (BASE) to S 62.3% / A 38.6%, and "no club" from S 29.2% / A 31.9% to S 0.9% / A 4.3%. By season 20 the shipped-world fifths are close to flat on both checkouts. The gate world's mean ovr is lower on the PR at every row, by 0.2–0.7; the shipped world's moves by 0.0–0.1.

Delivery: this branch, `cloud-run/r3-1078-gen1-1`. No PR was opened.
