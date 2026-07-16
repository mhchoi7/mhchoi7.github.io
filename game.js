(() => {
  class SnakeGame {
    constructor({ canvas, scoreEl, highScoreEl, statusEl, actionButtons, directionButtons }) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.scoreEl = scoreEl;
      this.highScoreEl = highScoreEl;
      this.statusEl = statusEl;
      this.actionButtons = actionButtons || [];
      this.directionButtons = directionButtons || [];
      this.gridSize = 20;
      this.cellSize = 21;
      this.boardPx = 420;
      this.baseStepMs = 120;
      this.speedBoostStep = 5;
      this.rafId = null;
      this.lastFrameTime = 0;
      this.accumulator = 0;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.score = 0;
      this.highScore = this.loadHighScore();
      this.direction = { x: 1, y: 0 };
      this.nextDirection = { x: 1, y: 0 };
      this.snake = [];
      this.food = { x: 0, y: 0 };
      this.deviceRatio = window.devicePixelRatio || 1;
      this.boundLoop = (time) => this.loop(time);
      this.boundResize = () => this.resize();
      this.boundKeydown = (event) => this.handleKeydown(event);
      this.boundVisibility = () => {
        if (document.hidden && this.running && !this.gameOver) {
          this.setPaused(true);
        }
      };
      this.resizeObserver = null;
    }

    mount() {
      if (!this.canvas || !this.ctx) return;
      this.resetBoard();
      this.bindEvents();
      this.resize();
      this.render();
      this.syncUi('Ready');
    }

    bindEvents() {
      this.actionButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const action = button.dataset.action;
          if (action === 'start') this.start();
          if (action === 'pause') this.togglePause();
          if (action === 'restart') this.restart();
        });
      });

      this.directionButtons.forEach((button) => {
        button.addEventListener('click', () => {
          this.queueDirection(button.dataset.direction);
          if (!this.running && !this.gameOver) this.start();
        });
      });

      window.addEventListener('keydown', this.boundKeydown);
      window.addEventListener('resize', this.boundResize);
      document.addEventListener('visibilitychange', this.boundVisibility);

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas);
      }
    }

    resize() {
      if (!this.canvas || !this.ctx) return;
      const rect = this.canvas.getBoundingClientRect();
      const size = Math.max(280, Math.floor(rect.width || this.boardPx));
      this.boardPx = size;
      this.deviceRatio = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(size * this.deviceRatio);
      this.canvas.height = Math.floor(size * this.deviceRatio);
      this.canvas.style.height = `${size}px`;
      this.ctx.setTransform(this.deviceRatio, 0, 0, this.deviceRatio, 0, 0);
      this.render();
    }

    resetBoard() {
      const center = Math.floor(this.gridSize / 2);
      this.snake = [
        { x: center, y: center },
        { x: center - 1, y: center },
        { x: center - 2, y: center },
      ];
      this.direction = { x: 1, y: 0 };
      this.nextDirection = { x: 1, y: 0 };
      this.score = 0;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.baseStepMs = 120;
      this.food = this.spawnFood();
      this.updateScore();
      this.syncUi('Ready');
    }

    start() {
      if (this.gameOver) {
        this.resetBoard();
      }
      this.running = true;
      this.paused = false;
      this.syncUi('Playing');
      this.ensureLoop();
    }

    restart() {
      this.stopLoop();
      this.resetBoard();
      this.running = true;
      this.syncUi('Playing');
      this.ensureLoop();
      this.render();
    }

    togglePause() {
      if (this.gameOver) return;
      if (!this.running) {
        this.start();
        return;
      }
      this.setPaused(!this.paused);
    }

    setPaused(paused) {
      if (this.gameOver) return;
      this.running = true;
      this.paused = paused;
      this.syncUi(paused ? 'Paused' : 'Playing');
      if (!paused) this.ensureLoop();
      this.render();
    }

    ensureLoop() {
      if (this.rafId !== null) return;
      this.lastFrameTime = 0;
      this.accumulator = 0;
      this.rafId = window.requestAnimationFrame(this.boundLoop);
    }

    stopLoop() {
      if (this.rafId === null) return;
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    loop(timestamp) {
      if (!this.running || this.gameOver) {
        this.stopLoop();
        return;
      }

      if (!this.lastFrameTime) {
        this.lastFrameTime = timestamp;
      }

      const delta = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      if (!this.paused) {
        this.accumulator += delta;
        while (this.accumulator >= this.baseStepMs && this.running && !this.paused && !this.gameOver) {
          this.step();
          this.accumulator -= this.baseStepMs;
        }
      }

      this.render();
      this.rafId = window.requestAnimationFrame(this.boundLoop);
    }

    queueDirection(name) {
      const directions = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };
      const next = directions[name];
      if (!next) return;
      if (this.isOpposite(next, this.direction) && this.snake.length > 1) return;
      this.nextDirection = next;
    }

    handleKeydown(event) {
      const key = event.key.toLowerCase();
      const directionMap = {
        arrowup: 'up',
        arrowdown: 'down',
        arrowleft: 'left',
        arrowright: 'right',
        w: 'up',
        a: 'left',
        s: 'down',
        d: 'right',
      };

      if (key === ' ' || key === 'spacebar') {
        event.preventDefault();
        this.togglePause();
        return;
      }

      const direction = directionMap[key];
      if (!direction) return;
      event.preventDefault();
      this.queueDirection(direction);
      if (!this.running && !this.gameOver) this.start();
    }

    step() {
      if (this.isOpposite(this.nextDirection, this.direction) && this.snake.length > 1) {
        this.nextDirection = this.direction;
      }

      this.direction = this.nextDirection;
      const head = this.snake[0];
      const nextHead = {
        x: head.x + this.direction.x,
        y: head.y + this.direction.y,
      };

      if (this.hitWall(nextHead) || this.hitSelf(nextHead)) {
        this.finishGame();
        return;
      }

      this.snake.unshift(nextHead);

      if (nextHead.x === this.food.x && nextHead.y === this.food.y) {
        this.score += 1;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          this.saveHighScore();
        }
        this.food = this.spawnFood();
        if (this.score % 5 === 0 && this.baseStepMs > 70) {
          this.baseStepMs -= this.speedBoostStep;
        }
      } else {
        this.snake.pop();
      }

      this.updateScore();
    }

    finishGame() {
      this.gameOver = true;
      this.running = false;
      this.paused = false;
      this.stopLoop();
      this.syncUi('Game over');
      this.updateScore();
      this.render();
    }

    hitWall(position) {
      return position.x < 0 || position.y < 0 || position.x >= this.gridSize || position.y >= this.gridSize;
    }

    hitSelf(position) {
      return this.snake.some((segment) => segment.x === position.x && segment.y === position.y);
    }

    isOpposite(a, b) {
      return a.x + b.x === 0 && a.y + b.y === 0;
    }

    spawnFood() {
      let food = { x: 0, y: 0 };
      do {
        food = {
          x: Math.floor(Math.random() * this.gridSize),
          y: Math.floor(Math.random() * this.gridSize),
        };
      } while (this.snake.some((segment) => segment.x === food.x && segment.y === food.y));
      return food;
    }

    updateScore() {
      if (this.scoreEl) this.scoreEl.textContent = String(this.score);
      if (this.highScoreEl) this.highScoreEl.textContent = String(this.highScore);
    }

    syncUi(status) {
      if (this.statusEl) this.statusEl.textContent = status;
    }

    loadHighScore() {
      try {
        return Number(window.localStorage.getItem('mhchoi7-snake-high-score')) || 0;
      } catch {
        return 0;
      }
    }

    saveHighScore() {
      try {
        window.localStorage.setItem('mhchoi7-snake-high-score', String(this.highScore));
      } catch {
        // Ignore storage failures and keep the session score.
      }
    }

    render() {
      if (!this.ctx || !this.canvas) return;
      const size = this.boardPx;
      const cell = size / this.gridSize;

      this.ctx.clearRect(0, 0, size, size);

      const background = this.ctx.createLinearGradient(0, 0, 0, size);
      background.addColorStop(0, '#07130d');
      background.addColorStop(1, '#04110a');
      this.ctx.fillStyle = background;
      this.ctx.fillRect(0, 0, size, size);

      this.ctx.strokeStyle = 'rgba(98, 255, 160, 0.08)';
      this.ctx.lineWidth = 1;
      for (let i = 0; i <= this.gridSize; i += 1) {
        const pos = Math.floor(i * cell) + 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(pos, 0);
        this.ctx.lineTo(pos, size);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(0, pos);
        this.ctx.lineTo(size, pos);
        this.ctx.stroke();
      }

      this.drawFood(cell);
      this.drawSnake(cell);
      this.drawOverlay(size);
    }

    drawFood(cell) {
      const x = this.food.x * cell;
      const y = this.food.y * cell;
      const radius = cell * 0.32;
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(255, 214, 106, 0.7)';
      this.ctx.shadowBlur = 18;
      this.ctx.fillStyle = '#ffd66a';
      this.roundRect(x + cell * 0.18, y + cell * 0.18, cell * 0.64, cell * 0.64, radius);
      this.ctx.fill();
      this.ctx.restore();
    }

    drawSnake(cell) {
      this.snake.forEach((segment, index) => {
        const x = segment.x * cell;
        const y = segment.y * cell;
        const inset = index === 0 ? 0.1 : 0.14;
        const fill = index === 0 ? '#44ff92' : '#1ebb66';
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(68, 255, 146, 0.35)';
        this.ctx.shadowBlur = index === 0 ? 18 : 8;
        this.ctx.fillStyle = fill;
        this.roundRect(x + cell * inset, y + cell * inset, cell * (1 - inset * 2), cell * (1 - inset * 2), cell * 0.24);
        this.ctx.fill();
        this.ctx.restore();
      });
    }

    drawOverlay(size) {
      if (!this.running && !this.gameOver && !this.paused && this.score === 0) {
        this.overlayText('Press Start to play', size);
      } else if (this.paused) {
        this.overlayText('Paused', size);
      } else if (this.gameOver) {
        this.overlayText('Game Over', size);
      }
    }

    overlayText(text, size) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(2, 10, 6, 0.42)';
      this.ctx.fillRect(0, 0, size, size);
      this.ctx.fillStyle = '#e1ffe9';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = '700 26px Trebuchet MS, Segoe UI, sans-serif';
      this.ctx.fillText(text, size / 2, size / 2);
      this.ctx.restore();
    }

    roundRect(x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      this.ctx.beginPath();
      this.ctx.moveTo(x + r, y);
      this.ctx.arcTo(x + width, y, x + width, y + height, r);
      this.ctx.arcTo(x + width, y + height, x, y + height, r);
      this.ctx.arcTo(x, y + height, x, y, r);
      this.ctx.arcTo(x, y, x + width, y, r);
      this.ctx.closePath();
    }
  }

  class DodgerGame {
    constructor({ canvas, scoreEl, highScoreEl, statusEl, actionButtons, directionButtons }) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.scoreEl = scoreEl;
      this.highScoreEl = highScoreEl;
      this.statusEl = statusEl;
      this.actionButtons = actionButtons || [];
      this.directionButtons = directionButtons || [];
      this.rafId = null;
      this.lastFrameTime = 0;
      this.accumulator = 0;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.score = 0;
      this.highScore = this.loadHighScore();
      this.boardSize = 420;
      this.laneCount = 5;
      this.playerLane = 2;
      this.poops = [];
      this.spawnTimer = 0;
      this.spawnInterval = 900;
      this.baseStepMs = 1000 / 60;
      this.boundLoop = (time) => this.loop(time);
      this.boundResize = () => this.resize();
      this.boundKeydown = (event) => this.handleKeydown(event);
      this.boundVisibility = () => {
        if (document.hidden && this.running && !this.gameOver) {
          this.setPaused(true);
        }
      };
      this.resizeObserver = null;
    }

    mount() {
      if (!this.canvas || !this.ctx) return;
      this.resetBoard();
      this.bindEvents();
      this.resize();
      this.render();
      this.syncUi('Ready');
    }

    bindEvents() {
      this.actionButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const action = button.dataset.dodgerAction;
          if (action === 'start') this.start();
          if (action === 'pause') this.togglePause();
          if (action === 'restart') this.restart();
        });
      });

      this.directionButtons.forEach((button) => {
        button.addEventListener('click', () => {
          this.queueDirection(button.dataset.dodgerDirection);
          if (!this.running && !this.gameOver) this.start();
        });
      });

      window.addEventListener('keydown', this.boundKeydown);
      window.addEventListener('resize', this.boundResize);
      document.addEventListener('visibilitychange', this.boundVisibility);

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas);
      }
    }

    resize() {
      if (!this.canvas || !this.ctx) return;
      const rect = this.canvas.getBoundingClientRect();
      const size = Math.max(280, Math.floor(rect.width || this.boardSize));
      this.boardSize = size;
      const ratio = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(size * ratio);
      this.canvas.height = Math.floor(size * ratio);
      this.canvas.style.height = `${size}px`;
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.render();
    }

    resetBoard() {
      this.playerLane = 2;
      this.poops = [];
      this.score = 0;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.spawnTimer = 0;
      this.spawnInterval = 900;
      this.updateScore();
      this.syncUi('Ready');
    }

    start() {
      if (this.gameOver) {
        this.resetBoard();
      }
      this.running = true;
      this.paused = false;
      this.syncUi('Playing');
      this.ensureLoop();
    }

    restart() {
      this.stopLoop();
      this.resetBoard();
      this.running = true;
      this.syncUi('Playing');
      this.ensureLoop();
      this.render();
    }

    togglePause() {
      if (this.gameOver) return;
      if (!this.running) {
        this.start();
        return;
      }
      this.setPaused(!this.paused);
    }

    setPaused(paused) {
      if (this.gameOver) return;
      this.running = true;
      this.paused = paused;
      this.syncUi(paused ? 'Paused' : 'Playing');
      if (!paused) this.ensureLoop();
      this.render();
    }

    ensureLoop() {
      if (this.rafId !== null) return;
      this.lastFrameTime = 0;
      this.accumulator = 0;
      this.rafId = window.requestAnimationFrame(this.boundLoop);
    }

    stopLoop() {
      if (this.rafId === null) return;
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    loop(timestamp) {
      if (!this.running || this.gameOver) {
        this.stopLoop();
        return;
      }

      if (!this.lastFrameTime) {
        this.lastFrameTime = timestamp;
      }

      const delta = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      if (!this.paused) {
        this.accumulator += delta;
        while (this.accumulator >= this.baseStepMs && this.running && !this.paused && !this.gameOver) {
          this.step(this.baseStepMs);
          this.accumulator -= this.baseStepMs;
        }
      }

      this.render();
      this.rafId = window.requestAnimationFrame(this.boundLoop);
    }

    queueDirection(name) {
      if (name === 'left') {
        this.playerLane = Math.max(0, this.playerLane - 1);
      }
      if (name === 'right') {
        this.playerLane = Math.min(this.laneCount - 1, this.playerLane + 1);
      }
    }

    handleKeydown(event) {
      const key = event.key.toLowerCase();
      const directionMap = {
        arrowleft: 'left',
        arrowright: 'right',
        a: 'left',
        d: 'right',
      };

      if (key === ' ' || key === 'spacebar') {
        event.preventDefault();
        this.togglePause();
        return;
      }

      const direction = directionMap[key];
      if (!direction) return;
      event.preventDefault();
      this.queueDirection(direction);
      if (!this.running && !this.gameOver) this.start();
    }

    step(deltaMs) {
      this.spawnTimer += deltaMs;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnPoop();
        if (this.spawnInterval > 420) {
          this.spawnInterval -= 40;
        }
      }

      const fallSpeed = this.boardSize * 0.0011 + this.score * 0.02;
      this.poops.forEach((poop) => {
        poop.y += fallSpeed * deltaMs;
      });

      const player = this.getPlayerRect();
      const remaining = [];
      let dodged = 0;

      for (const poop of this.poops) {
        if (this.intersects(player, poop)) {
          this.finishGame();
          return;
        }

        if (poop.y > this.boardSize + poop.height) {
          dodged += 1;
        } else {
          remaining.push(poop);
        }
      }

      if (this.gameOver) return;

      this.poops = remaining;
      if (dodged > 0) {
        this.score += dodged;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          this.saveHighScore();
        }
        this.updateScore();
      }
    }

    finishGame() {
      this.gameOver = true;
      this.running = false;
      this.paused = false;
      this.stopLoop();
      this.syncUi('Game over');
      this.updateScore();
      this.render();
    }

    spawnPoop() {
      const laneWidth = this.boardSize / this.laneCount;
      const lane = Math.floor(Math.random() * this.laneCount);
      const size = laneWidth * 0.56;
      this.poops.push({
        x: lane * laneWidth + (laneWidth - size) / 2,
        y: -size,
        width: size,
        height: size,
      });
    }

    getPlayerRect() {
      const laneWidth = this.boardSize / this.laneCount;
      const width = laneWidth * 0.56;
      const height = this.boardSize * 0.1;
      const x = this.playerLane * laneWidth + (laneWidth - width) / 2;
      const y = this.boardSize - height - this.boardSize * 0.06;
      return { x, y, width, height };
    }

    intersects(player, poop) {
      return !(
        poop.x + poop.width < player.x ||
        poop.x > player.x + player.width ||
        poop.y + poop.height < player.y ||
        poop.y > player.y + player.height
      );
    }

    updateScore() {
      if (this.scoreEl) this.scoreEl.textContent = String(this.score);
      if (this.highScoreEl) this.highScoreEl.textContent = String(this.highScore);
    }

    syncUi(status) {
      if (this.statusEl) this.statusEl.textContent = status;
    }

    loadHighScore() {
      try {
        return Number(window.localStorage.getItem('mhchoi7-dodger-high-score')) || 0;
      } catch {
        return 0;
      }
    }

    saveHighScore() {
      try {
        window.localStorage.setItem('mhchoi7-dodger-high-score', String(this.highScore));
      } catch {
        // Ignore storage failures and keep the session score.
      }
    }

    render() {
      if (!this.ctx || !this.canvas) return;
      const size = this.boardSize;
      const laneWidth = size / this.laneCount;
      this.ctx.clearRect(0, 0, size, size);

      const background = this.ctx.createLinearGradient(0, 0, 0, size);
      background.addColorStop(0, '#07130d');
      background.addColorStop(1, '#04110a');
      this.ctx.fillStyle = background;
      this.ctx.fillRect(0, 0, size, size);

      this.ctx.strokeStyle = 'rgba(98, 255, 160, 0.08)';
      this.ctx.lineWidth = 1;
      for (let i = 0; i <= this.laneCount; i += 1) {
        const pos = Math.floor(i * laneWidth) + 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(pos, 0);
        this.ctx.lineTo(pos, size);
        this.ctx.stroke();
      }

      this.poops.forEach((poop) => {
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(255, 112, 89, 0.5)';
        this.ctx.shadowBlur = 16;
        this.ctx.fillStyle = '#7a4b29';
        this.roundRect(poop.x, poop.y, poop.width, poop.height, poop.width * 0.3);
        this.ctx.fill();
        this.ctx.fillStyle = '#5c331a';
        this.roundRect(poop.x + poop.width * 0.22, poop.y + poop.height * 0.22, poop.width * 0.56, poop.height * 0.38, poop.width * 0.18);
        this.ctx.fill();
        this.ctx.restore();
      });

      const player = this.getPlayerRect();
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(68, 255, 146, 0.35)';
      this.ctx.shadowBlur = 14;
      this.ctx.fillStyle = '#44ff92';
      this.roundRect(player.x, player.y, player.width, player.height, player.height * 0.4);
      this.ctx.fill();
      this.ctx.restore();

      if (!this.running && !this.gameOver && !this.paused && this.score === 0) {
        this.overlayText('Press Start to play', size);
      } else if (this.paused) {
        this.overlayText('Paused', size);
      } else if (this.gameOver) {
        this.overlayText('Game Over', size);
      }
    }

    overlayText(text, size) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(2, 10, 6, 0.42)';
      this.ctx.fillRect(0, 0, size, size);
      this.ctx.fillStyle = '#e1ffe9';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = '700 26px Trebuchet MS, Segoe UI, sans-serif';
      this.ctx.fillText(text, size / 2, size / 2);
      this.ctx.restore();
    }

    roundRect(x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      this.ctx.beginPath();
      this.ctx.moveTo(x + r, y);
      this.ctx.arcTo(x + width, y, x + width, y + height, r);
      this.ctx.arcTo(x + width, y + height, x, y + height, r);
      this.ctx.arcTo(x, y + height, x, y, r);
      this.ctx.arcTo(x, y, x + width, y, r);
      this.ctx.closePath();
    }
  }

  window.SnakeGame = SnakeGame;
  window.DodgerGame = DodgerGame;
})();
