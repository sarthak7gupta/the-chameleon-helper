# The Chameleon

A simple, beautiful single-page web application for playing The Chameleon game with an interactive 4x4 grid and dice.

Also available as a Python CLI application!

## Features

- 🎲 **Random Topic Selection**: Automatically selects a random topic from `data.json` and displays 16 items
- 📊 **4x4 Grid Display**: Beautiful grid layout with column headers (A-D) and row headers (1-4)
- 🎯 **Interactive Dice**: Two dice (D6 with dots and D8 with numbers) that roll together
- 🎨 **Beautiful UI**: Soothing pastel colors with smooth animations
- 🔄 **Shuffle Button**: Easily switch to a new random topic

## Technology Stack

- **HTML5**: Structure
- **CSS3**: Styling and animations
- **JavaScript**: Game logic and interactivity

## Project Structure

```text
the-chameleon/
├── index.html         # Main HTML file (contains HTML, CSS, and JavaScript)
├── main.py            # Python CLI version of the game
├── pyproject.toml    # Python project configuration (dependencies, tools)
├── tests/             # Test suite
│   ├── __init__.py
│   └── test_chameleon.py
└── README.md          # This file
```

---

## Python CLI Version

### Installation

1. **Install Python 3.12 or later** (if not already installed)

2. **Install dependencies:**

```bash
# Using uv (recommended)
uv install

# Or using pip
pip install -e ".[dev]"
```

### Usage

**Interactive Mode (default):**

```bash
uv run main.py
```

**Command-line Commands:**

```bash
# Roll dice once and exit
uv run main.py roll

# Shuffle to a new topic
uv run main.py shuffle

# Display statistics
uv run main.py stats

# Run in interactive mode (explicit)
uv run main.py interactive
```

**Interactive Commands:**

Once in interactive mode, you can use:

- `roll` or `r` - Roll both D6 and D8 dice
- `shuffle` or `s` - Shuffle to a new random topic
- `stats` - Show roll statistics
- `help` or `h` - Show help message
- `quit` or `q` - Exit the game

### Features - General

- 🎲 Interactive dice rolling (D6 and D8)
- 📊 Beautiful terminal grid display with Rich library
- 📈 Statistics tracking for dice rolls
- 🎯 Automatic item selection based on dice values
- 🎨 Colorful terminal output

---

## For End Users

### Quick Start

**No installation required!** Just open the HTML file in a web browser.

1. **Download or clone this repository:**

```bash
git clone <repository-url>
cd the-chameleon
```

2. **Open in your browser:**

    - **Option 1**: Double-click `index.html` to open it in your default browser
    - **Option 2**: Right-click `index.html` → "Open with" → Choose your browser
    - **Option 3**: Drag and drop `index.html` into your browser window

3. **That's it!** The game is ready to play.

### Usage - General

1. **View the Grid**: The app automatically loads a random topic and displays 16 items in a 4x4 grid
2. **Roll Dice**: Click the "🎲 Roll Dice" button to roll both dice together
3. **Shuffle Topic**: Click the "🎲 Shuffle Topic" button at the bottom to select a new random topic
4. **Explore Items**: Hover over grid cells to see interactive effects

### Running with a Local Server (Optional)

For best results, you can use a local web server:

**Using Python:**

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Then open `http://localhost:8000` in your browser.

**Using Node.js:**

```bash
npx http-server -p 8000
```

**Using PHP:**

```bash
php -S localhost:8000
```

---

## For Developers

### Development Setup

1. **Clone the repository:**

```bash
git clone <repository-url>
cd the-chameleon
```

2. **Install development dependencies:**

```bash
# Using uv (recommended)
uv install --group dev

# Or using pip
pip install -e ".[dev]"
```

3. **Run tests:**

```bash
# Using taskipy (recommended)
task test

# Or directly with pytest
pytest
```

### Development Tasks

This project uses [taskipy](https://github.com/taskipy/taskipy) for task management. Available tasks:

```bash
# Run tests
task test

# Run tests with coverage
task test-cov

# Lint code
task lint

# Auto-fix linting issues
task lint-fix

# Format code
task format

# Type check
task type-check

# Run all checks (lint, type-check, test)
task check

# Run everything
task all
```

### Testing

The project uses `pytest` for testing. Tests are located in the `tests/` directory.

**Run tests:**

```bash
task test
```

**Run tests with coverage:**

```bash
task test-cov
```

**Run specific test file:**

```bash
pytest tests/test_chameleon.py
```

**Run specific test:**

```bash
pytest tests/test_chameleon.py::TestChameleonGame::test_roll_d6
```

**Check test coverage:**

```bash
task test-cov
```

### Code Quality

**Linting:**
The project uses `ruff` for linting and formatting.

```bash
# Check for issues
task lint

# Auto-fix issues
task lint-fix

# Format code
task format
```

**Type Checking:**
The project uses `ty` for type checking.

```bash
task type-check
```

**Run all checks:**

```bash
task check
```

### Making Changes

#### File Structure

- `index.html`: Contains all HTML structure, CSS styles, and JavaScript game logic in a single file
- All styles, animations, and game logic are embedded within the HTML file
- Topic and item data is embedded inline in the JavaScript section

#### Customization

**Changing Topics:**

Edit the `data` object in `index.html` (around line 348) to add, remove, or modify topics and their items:

```javascript
const data = {
    "Topic Name": [
        "Item 1",
        "Item 2",
        ...
    ]
};
```

**Styling:**

Edit the `<style>` section in `index.html` to customize colors, fonts, sizes, and animations. The CSS uses CSS variables defined in `:root`:

```css
:root {
    --color-primary: #a8d5ba;
    --color-secondary: #f4c2c2;
    ...;
}
```

**Game Logic:**

Edit the `<script>` section in `index.html` to modify game behavior, dice rolling, or grid generation.

**Dice Animation Speed:**

The dice roll animation timing can be adjusted in the `rollBothDice()` function:

- Update interval: Currently 120ms (controls how often dice faces change during roll)
- Total duration: Currently 2000ms (controls how long the animation lasts)

### How It Works

- The app uses inline data embedded in the HTML file
- Randomly selects one topic and picks 16 items from that topic
- Displays items in a 4x4 grid with headers (A-D columns, 1-4 rows)
- D6 dice shows dots (pips) in standard dice patterns
- D8 dice shows numbers (1-8) with a custom SVG design
- Both dice roll together when the roll button is clicked with a smooth 2-second animation
- Dice faces update every 120ms during the rolling animation
- All interactions feature smooth CSS animations and transitions

### Development Workflow

**For HTML/Web version:**

1. Make changes to the `index.html` file (HTML, CSS, and JavaScript are all in one file)
2. Refresh the browser to see changes
3. Use browser DevTools (F12) to debug
4. Test in multiple browsers if needed

**For Python CLI:**

1. Make changes to `main.py` or test files
2. Run tests: `task test`
3. Check code quality: `task check`
4. Test manually: `uv run main.py`

## License

MIT
