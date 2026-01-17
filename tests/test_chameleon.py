"""Tests for the ChameleonGame class."""

from unittest.mock import MagicMock, patch

from main import GAME_DATA, ChameleonGame, GameState, interactive, main, roll


class TestGameState:
    """Test GameState dataclass."""

    def test_initial_state(self):
        """Test that GameState initializes with correct defaults."""
        state = GameState()
        assert state.current_topic == ""
        assert state.current_items == []
        assert state.d6_value == 1
        assert state.d8_value == 1
        assert len(state.d6_stats) == 0
        assert len(state.d8_stats) == 0


class TestChameleonGame:
    """Test ChameleonGame class."""

    def test_initialization(self):
        """Test that game initializes correctly."""
        game = ChameleonGame()
        assert game.state is not None
        assert game.state.current_topic in GAME_DATA
        assert len(game.state.current_items) == 16

    def test_get_random_topic_and_items(self):
        """Test topic and items selection."""
        game = ChameleonGame()
        topic, items = game._get_random_topic_and_items()
        assert topic in GAME_DATA
        assert len(items) == 16
        assert all(item in GAME_DATA[topic] for item in items)

    def test_get_random_topic_and_items_multiple_calls(self):
        """Test that get_random_topic_and_items can be called multiple times."""
        game = ChameleonGame()
        topics_seen = set()
        for _ in range(20):
            topic, items = game._get_random_topic_and_items()
            topics_seen.add(topic)
            assert len(items) == 16
        # Should see at least one topic (likely all of them)
        assert len(topics_seen) > 0

    def test_shuffle_topic(self):
        """Test that shuffling changes the topic."""
        game = ChameleonGame()
        original_topic = game.state.current_topic
        original_items = game.state.current_items.copy()

        # Shuffle multiple times to ensure we get a different topic eventually
        # (since it's random, we might get the same topic, so we'll check items)
        for _ in range(10):
            game.shuffle_topic()
            if game.state.current_topic != original_topic or game.state.current_items != original_items:
                break

        # At least one of these should be different after shuffling
        assert game.state.current_topic != original_topic or game.state.current_items != original_items

    def test_roll_d6(self):
        """Test D6 dice rolling."""
        game = ChameleonGame()
        values = set()
        for _ in range(100):
            value = game.roll_d6()
            assert 1 <= value <= 6
            values.add(value)
        # Should see multiple different values
        assert len(values) > 1

    def test_roll_d8(self):
        """Test D8 dice rolling."""
        game = ChameleonGame()
        values = set()
        for _ in range(100):
            value = game.roll_d8()
            assert 1 <= value <= 8
            values.add(value)
        # Should see multiple different values
        assert len(values) > 1

    def test_roll_both_dice(self):
        """Test rolling both dice and statistics tracking."""
        game = ChameleonGame()
        d6, d8 = game.roll_both_dice()
        assert 1 <= d6 <= 6
        assert 1 <= d8 <= 8
        assert game.state.d6_value == d6
        assert game.state.d8_value == d8
        assert game.state.d6_stats[d6] == 1
        assert game.state.d8_stats[d8] == 1

        # Roll again and check stats increment
        d6_2, _ = game.roll_both_dice()
        if d6_2 == d6:
            assert game.state.d6_stats[d6] == 2
        else:
            assert game.state.d6_stats[d6_2] == 1

    def test_display_grid(self):
        """Test that display_grid doesn't crash."""
        game = ChameleonGame()
        game.display_grid()

    def test_display_grid_empty_items(self):
        """Test display_grid with empty items."""
        game = ChameleonGame()
        game.state.current_items = []
        game.display_grid()  # Should print error message

    def test_display_dice(self):
        """Test that display_dice doesn't crash."""
        game = ChameleonGame()
        game.display_dice()

    def test_display_dice_with_values(self):
        """Test display_dice with specific values."""
        game = ChameleonGame()
        game.display_dice(d6=3, d8=5)

    def test_display_dice_partial_values(self):
        """Test display_dice with one None value."""
        game = ChameleonGame()
        game.state.d6_value = 2
        game.state.d8_value = 7
        game.display_dice(d6=4, d8=None)
        game.display_dice(d6=None, d8=3)

    def test_display_stats_no_stats(self):
        """Test display_stats with no statistics."""
        game = ChameleonGame()
        game.display_stats()  # Should print message about no rolls

    def test_display_stats_with_stats(self):
        """Test display_stats with statistics."""
        game = ChameleonGame()
        # Roll dice a few times
        for _ in range(5):
            game.roll_both_dice()
        game.display_stats()

    def test_display_stats_edge_cases(self):
        """Test display_stats with edge cases."""
        game = ChameleonGame()
        # Set stats manually
        game.state.d6_stats[1] = 10
        game.state.d6_stats[6] = 1
        game.state.d8_stats[1] = 5
        game.state.d8_stats[8] = 2
        game.display_stats()

    def test_show_help(self):
        """Test that _show_help doesn't crash."""
        game = ChameleonGame()
        game._show_help()

    def test_statistics_tracking(self):
        """Test that statistics are properly tracked across multiple rolls."""
        game = ChameleonGame()
        initial_d6_total = sum(game.state.d6_stats.values())
        initial_d8_total = sum(game.state.d8_stats.values())

        # Roll dice multiple times
        for _ in range(10):
            game.roll_both_dice()

        d6_total = sum(game.state.d6_stats.values())
        d8_total = sum(game.state.d8_stats.values())

        assert d6_total == initial_d6_total + 10
        assert d8_total == initial_d8_total + 10

    def test_all_topics_have_enough_items(self):
        """Test that all topics have at least 16 items."""
        for topic, items in GAME_DATA.items():
            assert len(items) >= 16, f"Topic {topic} has only {len(items)} items, need at least 16"

    def test_run_interactive_called(self):
        """Test that run_interactive can be called without crashing."""
        game = ChameleonGame()
        # Mock console.input to return quit immediately
        mock_input = MagicMock(return_value="quit")
        game.console.input = mock_input  # ty: ignore[invalid-assignment]
        game.console.print = MagicMock()  # ty: ignore[invalid-assignment]

        with patch.object(game, "display_grid"), patch.object(game, "display_dice"):
            try:
                game.run_interactive()
            except (KeyboardInterrupt, EOFError):
                pass

    def test_run_interactive_quit(self):
        """Test run_interactive with quit command."""
        game = ChameleonGame()
        game.console.input = MagicMock(return_value="quit")  # ty: ignore[invalid-assignment]
        game.console.print = MagicMock()  # ty: ignore[invalid-assignment]

        with patch.object(game, "display_grid"), patch.object(game, "display_dice"):
            try:
                game.run_interactive()
            except (KeyboardInterrupt, EOFError):
                pass

    def test_run_interactive_help(self):
        """Test run_interactive with help command."""
        game = ChameleonGame()
        game.console.input = MagicMock(side_effect=["help", "quit"])  # ty: ignore[invalid-assignment]
        game.console.print = MagicMock()  # ty: ignore[invalid-assignment]

        with patch.object(game, "display_grid"), patch.object(game, "display_dice"):
            try:
                game.run_interactive()
            except (KeyboardInterrupt, EOFError):
                pass

    def test_run_interactive_roll(self):
        """Test run_interactive with roll command."""
        game = ChameleonGame()
        game.console.input = MagicMock(side_effect=["roll", "quit"])  # ty: ignore[invalid-assignment]
        game.console.print = MagicMock()  # ty: ignore[invalid-assignment]

        with (
            patch.object(game, "display_grid"),
            patch.object(game, "display_dice"),
            patch.object(
                game,
                "roll_both_dice",
                return_value=(3, 4),
            ),
            patch.object(game, "shuffle_topic"),
        ):
            try:
                game.run_interactive()
            except (KeyboardInterrupt, EOFError):
                pass

    def test_run_interactive_stats(self):
        """Test run_interactive with stats command."""
        game = ChameleonGame()
        game.console.input = MagicMock(side_effect=["stats", "quit"])  # ty: ignore[invalid-assignment]
        game.console.print = MagicMock()  # ty: ignore[invalid-assignment]

        with (
            patch.object(game, "display_grid"),
            patch.object(game, "display_dice"),
            patch.object(
                game,
                "display_stats",
            ),
        ):
            try:
                game.run_interactive()
            except (KeyboardInterrupt, EOFError):
                pass

    def test_run_interactive_unknown_command(self):
        """Test run_interactive with unknown command."""
        game = ChameleonGame()
        game.console.input = MagicMock(side_effect=["unknown", "quit"])  # ty: ignore[invalid-assignment]
        game.console.print = MagicMock()  # ty: ignore[invalid-assignment]

        with patch.object(game, "display_grid"), patch.object(game, "display_dice"):
            try:
                game.run_interactive()
            except (KeyboardInterrupt, EOFError):
                pass


class TestMainFunction:
    """Test the main() function and CLI."""

    @patch("main.ChameleonGame")
    def test_main_roll(self, mock_game_class):
        """Test main function with roll command."""
        mock_game = MagicMock()
        mock_game_class.return_value = mock_game
        mock_game.roll_both_dice.return_value = (3, 4)

        roll()

        mock_game.shuffle_topic.assert_called_once()
        mock_game.roll_both_dice.assert_called_once()
        mock_game.display_dice.assert_called_once_with(d6=3, d8=4)

    @patch("main.ChameleonGame")
    @patch("sys.argv", ["main.py"])
    def test_main_interactive(self, mock_game_class):
        """Test main function with no arguments (interactive mode)."""
        mock_game = MagicMock()
        mock_game_class.return_value = mock_game

        main()

        mock_game.run_interactive.assert_called_once()

    @patch("main.ChameleonGame")
    def test_main_interactive_command(self, mock_game_class):
        """Test main function with interactive command."""
        mock_game = MagicMock()
        mock_game_class.return_value = mock_game

        interactive()

        mock_game.run_interactive.assert_called_once()


class TestGameData:
    """Test game data structure."""

    def test_game_data_structure(self):
        """Test that GAME_DATA has the expected structure."""
        assert isinstance(GAME_DATA, dict)
        assert len(GAME_DATA) > 0

        for topic, items in GAME_DATA.items():
            assert isinstance(topic, str)
            assert isinstance(items, list)
            assert len(items) > 0
            assert all(isinstance(item, str) for item in items)

    def test_all_items_are_unique(self):
        """Test that items within each topic are unique."""
        for topic, items in GAME_DATA.items():
            assert len(items) == len(set(items)), f"Topic {topic} has duplicate items"

    def test_game_data_not_empty(self):
        """Test that GAME_DATA contains topics."""
        assert len(GAME_DATA) >= 3  # Should have at least Games, Video Games, Food
