// Turkish Boggle Dice Configuration (Approximate frequency)
// Including Turkish characters: Ç, Ğ, I, İ, Ö, Ş, Ü
const DICE = [
    "AEEGmN", "AAEOOT", "AIIŞST", "EİİOŞT",
    "AABFKP", "EEGHNV", "DEİLRY", "DEİLĞR",
    "BJKLMZ", "EEİNSU", "EHRTVZ", "HLNNRZ",
    "IMOTUÜ", "AÇELRS", "DİSTTY", "OÖPRTY"
];

// Extra Dice for 5x5 (Big Boggle style extension)
const DICE_EXTENDED = [
    "AAAFRS", "AAEEEE", "AAFIRS", "ADENNN", "AEEEEM",
    "AEEGMU", "AEGMNN", "AFIRSY", "BJKQXZ", "CCENST",
    "CEIILT", "CEILPT", "CEIPST", "DDHNOT", "DHHLOR",
    "DHLNOR", "DDLNOR", "EIIITT", "EMOTTT", "ENSSSU",
    "FIPRSY", "GORRVW", "HIPRRY", "NOOTUW", "OOOTTU"
];

// Scoring rules
const SCORING = {
    3: 1, 4: 1, 5: 2, 6: 3, 7: 5, 8: 11
};

class BoggleGame {
    constructor() {
        this.gameDuration = 120; // seconds
        this.timer = this.gameDuration;
        this.score = 0;
        this.foundWords = new Set();
        this.isGameActive = false;
        this.grid = []; // 2D array of chars
        this.selectedCells = []; // Array of {r, c}
        this.timerInterval = null;

        // UI Elements
        this.gridEl = document.getElementById('boggle-grid');
        this.currentWordEl = document.getElementById('current-word');
        this.scoreEl = document.getElementById('score');
        this.timerEl = document.getElementById('timer');
        this.foundWordsEl = document.getElementById('found-count');
        this.wordListEl = document.getElementById('word-list');
        this.gameOverModal = document.getElementById('game-over-modal');
        this.finalScoreEl = document.getElementById('final-score');
        this.messageToast = document.getElementById('message-toast');
        this.drawerElement = document.getElementById('found-words-drawer');

        // Start Menu Elements
        this.startMenuModal = document.getElementById('start-menu-modal');
        this.step1 = document.getElementById('menu-step-1');
        this.step2 = document.getElementById('menu-step-2');
        this.nicknameInput = document.getElementById('nickname-input');

        document.getElementById('btn-next-step').addEventListener('click', () => this.goToStep2());
        document.getElementById('btn-back-step').addEventListener('click', () => this.goToStep1());
        document.getElementById('nickname-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.goToStep2();
        });

        document.getElementById('btn-4x4').addEventListener('click', () => this.startGame(4));
        document.getElementById('btn-5x5').addEventListener('click', () => this.startGame(5));

        // Buttons
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.addEventListener('click', () => this.submitWord());

        document.getElementById('clear-btn').addEventListener('click', () => this.clearSelection());
        document.getElementById('restart-btn').addEventListener('click', () => this.resetMenu());

        // Drawer toggle
        document.querySelector('.drawer-handle').addEventListener('click', () => {
            this.drawerElement.classList.toggle('open');
        });

        this.highScores = this.loadScores();
        this.renderHighScores();

        // Bind interaction events
        this.isDragging = false;
        this.bindGridEvents();
    }

    loadScores() {
        try {
            return JSON.parse(localStorage.getItem('boggle_scores')) || [];
        } catch (e) {
            return [];
        }
    }

    saveScore(score) {
        if (score === 0) return; // Don't save 0 scores

        const dateStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        this.highScores.push({ score, date: dateStr, timestamp: Date.now() });

        // Sort descending
        this.highScores.sort((a, b) => b.score - a.score);

        // Keep top 10
        this.highScores = this.highScores.slice(0, 10);

        localStorage.setItem('boggle_scores', JSON.stringify(this.highScores));
        this.renderHighScores();
    }

    renderHighScores() {
        const listEl = document.getElementById('high-score-list');
        if (!listEl) return;

        if (this.highScores.length === 0) {
            listEl.innerHTML = '<li class="empty-message">Henüz skor yok.</li>';
            return;
        }

        listEl.innerHTML = this.highScores.map((s, index) => `
            <li>
                <span class="date">${index + 1}. ${s.date}</span>
                <span class="score">${s.score} Puan</span>
            </li>
        `).join('');
    }

    goToStep1() {
        this.step2.style.display = 'none';
        this.step1.style.display = 'block';
    }

    goToStep2() {
        const nick = this.nicknameInput.value.trim();
        if (!nick) {
            this.nicknameInput.style.borderColor = 'var(--brand-red)';
            this.nicknameInput.classList.add('shake');
            setTimeout(() => {
                this.nicknameInput.classList.remove('shake');
                this.nicknameInput.style.borderColor = '#444';
            }, 500);
            return;
        }
        this.nickname = nick;
        this.step1.style.display = 'none';
        this.step2.style.display = 'block';
    }

    resetMenu() {
        this.gameOverModal.classList.remove('visible');
        this.startMenuModal.classList.add('visible');
        // Reset to Step 1? or Step 2 if name known?
        // Let's reset to Step 2 so they can pick size again without re-typing name if they want.
        // Or user might want to change name.
        // Let's stick to Step 2 for convenience if nickname exists.
        if (this.nickname) {
            this.goToStep2();
        } else {
            this.goToStep1();
        }

        // Clear grid visuals
        this.gridEl.innerHTML = '';
        this.currentWordEl.textContent = '';
        this.resetState();
    }

    startGame(size) {
        // Nickname already validated in goToStep2
        this.gridSize = size;
        this.startMenuModal.classList.remove('visible');

        // Set Duration
        this.gameDuration = 45;
        this.timer = this.gameDuration;

        // Adjust CSS Grid Columns dynamically
        this.gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

        // Prepare the grid immediately (so it shows under the blur)
        this.generateGrid();

        // Start Countdown
        this.startCountdown(() => {
            this.initGame();
        });
    }

    startCountdown(callback) {
        const overlay = document.getElementById('countdown-overlay');
        const numEl = document.getElementById('countdown-number');
        overlay.classList.add('visible');

        // Ensure overlay is strictly above others
        overlay.style.display = 'flex';

        let count = 3;

        const runStep = () => {
            numEl.textContent = count;
            // Reset animation
            numEl.style.animation = 'none';
            numEl.offsetHeight; /* trigger reflow */
            numEl.style.animation = null;

            if (count > 0) {
                setTimeout(() => {
                    count--;
                    if (count === 0) {
                        // "GO!" with Nickname
                        const safeNick = this.nickname.toLocaleUpperCase('tr-TR');
                        // Use smaller font for text if needed, handled by CSS clamp hopefully, 
                        // but we might want to split lines
                        numEl.innerHTML = `BAŞLA<br><span style="font-size: 0.5em">${safeNick}!</span>`;

                        // Reset animation
                        numEl.style.animation = 'none';
                        numEl.offsetHeight; /* trigger reflow */
                        numEl.style.animation = null;

                        setTimeout(() => {
                            overlay.classList.remove('visible');
                            overlay.style.display = 'none';
                            callback();
                        }, 1000); // 1 second display for "BAŞLA NAME!"
                    } else {
                        runStep();
                    }
                }, 1000);
            }
        };

        runStep();
    }

    initGame() {
        // Grid already generated in startGame
        // this.generateGrid(); 
        this.startTimer();
        this.isGameActive = true;
        this.resetState();
    }

    resetState() {
        this.score = 0;
        this.foundWords.clear();
        this.selectedCells = [];
        this.updateUI();
        this.renderWordList(); // Clear list
        let missedCont = document.getElementById('missed-words-container');
        if (missedCont) missedCont.innerHTML = '';
    }

    restartGame() {
        // Not used directly anymore, goes to menu
        this.resetMenu();
    }

    generateGrid() {
        const MIN_WORDS = 15; // Minimum words required for a "good" game
        const MAX_ATTEMPTS = 50;
        let bestGrid = [];
        let maxFound = -1;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            this.buildGridData();
            const possibleWords = this.solveGrid(); // Uses this.grid

            if (possibleWords.length >= MIN_WORDS) {
                console.log(`Grid generated in ${i + 1} attempts with ${possibleWords.length} words.`);
                this.renderGrid();
                return;
            }

            if (possibleWords.length > maxFound) {
                maxFound = possibleWords.length;
                bestGrid = JSON.parse(JSON.stringify(this.grid));
            }
        }

        // Fallback to best found
        console.warn(`Could not find ${MIN_WORDS} words. Best was ${maxFound}.`);
        this.grid = bestGrid;
        this.renderGrid();
    }

    buildGridData() {
        // Choose dice set based on size
        let sourceDice = this.gridSize === 5 ? [...DICE, ...DICE_EXTENDED] : [...DICE];

        const totalSorts = this.gridSize * this.gridSize;
        while (sourceDice.length < totalSorts) {
            sourceDice = [...sourceDice, ...DICE];
        }

        // Shuffle dice
        let shuffledDice = sourceDice.sort(() => Math.random() - 0.5).slice(0, totalSorts);

        this.grid = [];

        for (let i = 0; i < this.gridSize; i++) {
            let row = [];
            for (let j = 0; j < this.gridSize; j++) {
                let dieIndex = i * this.gridSize + j;
                let die = shuffledDice[dieIndex];
                let char = die.charAt(Math.floor(Math.random() * 6));

                char = char.toLocaleUpperCase('tr-TR');

                row.push(char);
            }
            this.grid.push(row);
        }
    }

    renderGrid() {
        this.gridEl.innerHTML = '';
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                this.createCellElement(i, j, this.grid[i][j]);
            }
        }
    }

    createCellElement(row, col, char) {
        const cell = document.createElement('div');
        cell.classList.add('die-cell');
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.textContent = char;
        this.gridEl.appendChild(cell);
    }

    bindGridEvents() {
        // Mouse Events
        this.gridEl.addEventListener('mousedown', (e) => this.handleInputStart(e));
        document.addEventListener('mousemove', (e) => this.handleInputMove(e));
        document.addEventListener('mouseup', () => this.handleInputEnd());

        // Touch Events
        this.gridEl.addEventListener('touchstart', (e) => this.handleInputStart(e));
        document.addEventListener('touchmove', (e) => this.handleInputMove(e));
        document.addEventListener('touchend', () => this.handleInputEnd());
    }

    getCellFromEvent(e) {
        // Handle both mouse and touch coordinates
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        // Use document.elementFromPoint to find the element under cursor/finger
        const element = document.elementFromPoint(clientX, clientY);
        return element ? element.closest('.die-cell') : null;
    }

    handleInputStart(e) {
        if (e.cancelable) e.preventDefault();

        if (!this.isGameActive) return;

        const cell = this.getCellFromEvent(e);
        if (cell) {
            this.isDragging = true;
            this.interactionMoved = false; // Reset move flag
            this.trySelectCell(cell);
        }
    }

    handleInputMove(e) {
        if (!this.isDragging || !this.isGameActive) return;

        const cell = this.getCellFromEvent(e);
        if (cell) {
            const previousLength = this.selectedCells.length;
            this.trySelectCell(cell);
            // If selection changed (added or backtracking), mark as moved
            if (this.selectedCells.length !== previousLength) {
                this.interactionMoved = true;
            } else {
                // Also check if we just moved to a different cell even if logic didn't select it 
                // (optional, but checking selection change is safer for "Drag vs Tap")
                // Actually, if we drag to neighbor and it gets selected, that's a move.
                // If we drag to non-neighbor (invalid), it's ignored.
            }
        }
    }

    handleInputEnd() {
        if (this.isDragging) {
            this.isDragging = false;

            // If user dragged across multiple cells (swiping), auto-submit.
            // If user just tapped (stationary click), keep selection (manual mode).
            // We use interactionMoved flag, but also check if we actually have >1 selected cells to submit.
            if (this.interactionMoved && this.selectedCells.length >= 1) {
                this.submitWord(true); // Auto submit
            }
        }
    }

    trySelectCell(cellEl) {
        const r = parseInt(cellEl.dataset.row);
        const c = parseInt(cellEl.dataset.col);

        // Check if already selected
        const lastSelected = this.selectedCells[this.selectedCells.length - 1];

        // If backtracking (moving to previous cell), deselect the last one
        if (this.selectedCells.length > 1) {
            const penUlt = this.selectedCells[this.selectedCells.length - 2];
            if (penUlt.r === r && penUlt.c === c) {
                this.deselectLast();
                return;
            }
        }

        // Check if cell is adjacent to last selected
        if (lastSelected) {
            const dr = Math.abs(r - lastSelected.r);
            const dc = Math.abs(c - lastSelected.c);
            // Must be adjacent and not same cell
            if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) {
                // Must not be already in selection (unless backtracking handled above)
                if (!this.isCellSelected(r, c)) {
                    this.selectCell(cellEl);
                }
            }
        } else {
            // First cell
            this.selectCell(cellEl);
        }
    }

    isCellSelected(r, c) {
        return this.selectedCells.some(cell => cell.r === r && cell.c === c);
    }

    selectCell(cellEl) {
        const r = parseInt(cellEl.dataset.row);
        const c = parseInt(cellEl.dataset.col);

        this.selectedCells.push({ r, c, el: cellEl });
        cellEl.classList.add('selected');
        // cellEl.classList.add('pop'); // Animation
        // setTimeout(() => cellEl.classList.remove('pop'), 200);
        this.updateCurrentWord();
    }

    deselectLast() {
        const removed = this.selectedCells.pop();
        if (removed) {
            removed.el.classList.remove('selected');
            this.updateCurrentWord();
        }
    }

    clearSelection() {
        this.selectedCells.forEach(item => item.el.classList.remove('selected'));
        this.selectedCells = [];
        this.updateCurrentWord();
    }

    updateCurrentWord() {
        const word = this.selectedCells.map(item => this.grid[item.r][item.c]).join('');
        this.currentWordEl.textContent = word;

        if (word.length > 0) {
            this.currentWordEl.classList.add('pop');
            setTimeout(() => this.currentWordEl.classList.remove('pop'), 100);
        }
    }

    submitWord(isAuto = false) {
        if (!this.isGameActive) return;

        let word = this.currentWordEl.textContent;
        // Use Turkish UpperCase for consistency
        word = word.toLocaleUpperCase('tr-TR');

        // Validation Logic
        if (word.length < 3) {
            // If auto-submit (drag release), don't show error for short words (just accidental clicks)
            if (!isAuto) {
                this.showMessage("Çok Kısa!", "error");
                this.animateInvalid();
            }
            this.clearSelection();
            return;
        }

        if (this.foundWords.has(word)) {
            this.showMessage("Zaten Bulundu!", "error");
            this.animateInvalid();
            this.clearSelection();
            return;
        }

        // Check against dictionary
        // commonWords should be loaded from dictionary.js and contain UPPERCASE Turkish words
        if (typeof commonWords !== 'undefined' && !commonWords.includes(word)) {
            this.showMessage("Kelime Bulunamadı", "error");
            this.animateInvalid();
            this.clearSelection();
            return;
        }

        // Valid Word
        this.addScore(word);
        this.foundWords.add(word);
        this.renderFoundWord(word);
        this.showMessage(`+${this.getScore(word)} Puan!`, "success");
        this.clearSelection();
    }

    getScore(word) {
        const len = word.length;
        if (len >= 8) return 11;
        return SCORING[len] || 1;
    }

    addScore(word) {
        this.score += this.getScore(word);
        this.updateUI();
    }

    renderFoundWord(word) {
        const li = document.createElement('li');
        li.textContent = word;
        li.classList.add('word-tag', 'pop');
        // Prepend to list
        this.wordListEl.insertBefore(li, this.wordListEl.firstChild);
    }

    renderWordList() {
        this.wordListEl.innerHTML = '';
        this.foundWords.forEach(word => this.renderFoundWord(word));
    }

    updateUI() {
        this.scoreEl.textContent = this.score;
        this.foundWordsEl.textContent = this.foundWords.size;
    }

    animateInvalid() {
        this.currentWordEl.classList.add('shake');
        setTimeout(() => this.currentWordEl.classList.remove('shake'), 500);
    }

    showMessage(msg, type) {
        this.messageToast.textContent = msg;
        this.messageToast.className = 'message-toast show';
        if (type === 'success') this.messageToast.classList.add('success');

        setTimeout(() => {
            this.messageToast.classList.remove('show');
        }, 1500);
    }

    startTimer() {
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            this.timer--;
            this.updateTimerDisplay();
            if (this.timer <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const m = Math.floor(this.timer / 60).toString().padStart(2, '0');
        const s = (this.timer % 60).toString().padStart(2, '0');
        this.timerEl.textContent = `${m}:${s}`;

        // Critical time warning
        if (this.timer <= 10) {
            this.timerEl.style.color = 'var(--brand-red)';
        } else {
            this.timerEl.style.color = 'var(--text-primary)';
        }
    }

    endGame() {
        clearInterval(this.timerInterval);
        this.isGameActive = false;
        this.finalScoreEl.textContent = this.score;
        this.gameOverModal.classList.add('visible');

        // Save High Score
        this.saveScore(this.score);

        // Solve grid and show missed words
        const allPossibleWords = this.solveGrid();
        const missedWords = allPossibleWords.filter(word => !this.foundWords.has(word));

        let missedContainer = document.getElementById('missed-words-container');
        if (!missedContainer) {
            missedContainer = document.createElement('div');
            missedContainer.id = 'missed-words-container';
            missedContainer.className = 'missed-words-section';
            this.finalScoreEl.parentNode.appendChild(missedContainer);
        }

        // Show top 30 missed words to avoid overflow, or scrollable
        const displayLimit = 50;
        const shownWords = missedWords.sort((a, b) => b.length - a.length).slice(0, displayLimit);

        let html = `<h3>Kaçırılan Kelimeler (${missedWords.length})</h3>`;
        html += `<div class="missed-list">
            ${shownWords.map(w => `<span class="word-tag missed">${w}</span>`).join('')}
            ${missedWords.length > displayLimit ? `<span class="more-count">+${missedWords.length - displayLimit} daha...</span>` : ''}
        </div>`;

        missedContainer.innerHTML = html;
    }

    solveGrid() {
        const found = new Set();
        const visited = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(false));

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                this.recursivelyFind(r, c, "", visited, found);
            }
        }
        return Array.from(found);
    }

    recursivelyFind(r, c, currentPrefix, visited, found) {
        // Bounds check
        if (r < 0 || r >= this.gridSize || c < 0 || c >= this.gridSize) return;
        if (visited[r][c]) return;

        let char = this.grid[r][c];
        const nextPrefix = currentPrefix + char;

        // Optimization: check if any word starts with this prefix?
        // Since we have a flat list, this might be slow without a Trie.
        // For a small dictionary (demo size) it's fine. For full dictionary we need Trie.
        // Let's do a simple check: is there ANY word in commonWords starting with nextPrefix?
        // Actually, with the small list provided, we can just check directly or iterate.
        // Given constraint: "commonWords" is global.

        // Check if prefix is valid start of any word
        // Optimization for performance:
        const potential = typeof commonWords !== 'undefined' && commonWords.some(w => w.startsWith(nextPrefix));
        if (!potential) return;

        visited[r][c] = true;

        if (nextPrefix.length >= 3 && commonWords.includes(nextPrefix)) {
            found.add(nextPrefix);
        }

        // Neighbors
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                this.recursivelyFind(r + dr, c + dc, nextPrefix, visited, found);
            }
        }

        visited[r][c] = false;
    }
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const game = new BoggleGame();
});
