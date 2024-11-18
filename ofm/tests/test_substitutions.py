from datetime import timedelta

import pytest

from ofm.core.football.formation import FormationError
from ofm.core.football.team_simulation import (
    GameEventType,
    PlayerSimulation,
    SubbingError,
    SubstitutionEvent,
)

from ..core.simulation.simulation import LiveGame, PitchPosition


def test_substitute_same_player(live_game: LiveGame):
    home_team = live_game.engine.home_team
    with pytest.raises(ValueError):
        home_team.sub_player(
            home_team.formation.fw[0],
            home_team.formation.fw[0],
            timedelta(minutes=45),
            timedelta(minutes=0),
        )


def test_substitute_invalid_player(live_game: LiveGame):
    home_team = live_game.engine.home_team
    away_team = live_game.engine.away_team
    with pytest.raises(FormationError):
        home_team.sub_player(
            home_team.formation.fw[0],
            away_team.formation.fw[0],
            timedelta(minutes=45),
            timedelta(minutes=0),
        )


def test_substitute_player(live_game: LiveGame):
    home_team = live_game.engine.home_team
    player_in = home_team.formation.bench[0]
    player_out = home_team.formation.fw[0]
    expected_sub = SubstitutionEvent(
        player_out,
        timedelta(minutes=45),
        GameEventType.SUBSTITUTION,
        player_in,
        timedelta(minutes=0),
    )
    home_team.sub_player(
        player_out,
        player_in,
        timedelta(minutes=45),
        timedelta(minutes=0),
    )
    assert player_in == home_team.formation.fw[0]
    assert player_out in home_team.formation.bench
    assert home_team.sub_history[0] == expected_sub


def test_substitute_invalid_order(live_game: LiveGame):
    home_team = live_game.engine.home_team
    player_in = home_team.formation.bench[0]
    player_out = home_team.formation.fw[0]
    with pytest.raises(ValueError):
        home_team.sub_player(
            player_in,
            player_out,
            timedelta(minutes=45),
            timedelta(minutes=0),
        )


def test_substitute_no_available_substitutions(live_game: LiveGame):
    home_team = live_game.engine.home_team
    home_team.substitutions = 5
    player_in = home_team.formation.bench[0]
    player_out = home_team.formation.fw[0]
    with pytest.raises(SubbingError):
        home_team.sub_player(
            player_out,
            player_in,
            timedelta(minutes=45),
            timedelta(minutes=0),
        )


def test_substitute_sent_off_player(live_game: LiveGame):
    home_team = live_game.engine.home_team
    player_in = home_team.formation.bench[0]
    player_out = home_team.formation.fw[0]
    player_out.statistics.red_cards = 1
    with pytest.raises(SubbingError):
        home_team.sub_player(
            player_out,
            player_in,
            timedelta(minutes=45),
            timedelta(minutes=0),
        )


def test_substitute_player_subbed(live_game: LiveGame):
    home_team = live_game.engine.home_team
    player_in = home_team.formation.bench[0]
    player_in.subbed = True
    player_out = home_team.formation.fw[0]
    with pytest.raises(SubbingError):
        home_team.sub_player(
            player_out,
            player_in,
            timedelta(minutes=45),
            timedelta(minutes=0),
        )


def test_substitute_player_in_was_sent_off(live_game: LiveGame):
    home_team = live_game.engine.home_team
    player_in = home_team.formation.bench[0]
    player_in.statistics.red_cards = 1
    player_out = home_team.formation.fw[0]
    with pytest.raises(SubbingError):
        home_team.sub_player(
            player_out,
            player_in,
            timedelta(minutes=45),
            timedelta(minutes=0),
        )


def test_get_player_on_pitch(live_game: LiveGame):
    home_team = live_game.engine.home_team
    unable_player = home_team.formation.players[-1]
    unable_player.able_to_play = False
    for _ in range(1500):
        for position in list(PitchPosition):
            player = home_team.get_player_on_pitch(position)
            assert isinstance(player, PlayerSimulation) is True
            assert player != unable_player
