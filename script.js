(() => {
  "use strict";

  const SIZE = 9;
  const BOX = 3;
  const TARGET_EMPTY = { easy: 36, medium: 45, hard: 52 };
  const boardElement = document.querySelector("#board");
  const numberPad = document.querySelector("#number-pad");
  const hintElement = document.querySelector("#tool-hint");
  const toastElement = document.querySelector("#toast");
  const cells = [];

  let solution = [];
  let puzzle = [];
  let values = [];
  let notes = [];
  let selected = -1;
  let noteMode = false;
  let mistakes = 0;
  let elapsedSeconds = 0;
  let timerId = null;
  let toastTimeout = null;
  let gameComplete = false;
  let checkShown = false;

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function shuffledBands() {
    const bands = shuffle([0, 1, 2]);
    return bands.flatMap((band) => shuffle([0, 1, 2]).map((row) => band * BOX + row));
  }

  function makeSolution() {
    const rows = shuffledBands();
    const columns = shuffledBands();
    const symbols = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    return rows.map((row) =>
      columns.map((column) => symbols[(row * BOX + Math.floor(row / BOX) + column) % SIZE]),
    );
  }

  function countSolutions(grid, limit = 2) {
    let bestRow = -1;
    let bestColumn = -1;
    let bestCandidates = null;

    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        if (grid[row][column] !== 0) continue;
        const candidates = [];
        for (let number = 1; number <= SIZE; number += 1) {
          if (isValidAt(grid, row, column, number)) candidates.push(number);
        }
        if (candidates.length === 0) return 0;
        if (bestCandidates === null || candidates.length < bestCandidates.length) {
          bestRow = row;
          bestColumn = column;
          bestCandidates = candidates;
          if (candidates.length === 1) break;
        }
      }
      if (bestCandidates?.length === 1) break;
    }

    if (bestCandidates === null) return 1;
    let solutions = 0;
    for (const number of bestCandidates) {
      grid[bestRow][bestColumn] = number;
      solutions += countSolutions(grid, limit - solutions);
      grid[bestRow][bestColumn] = 0;
      if (solutions >= limit) return solutions;
    }
    return solutions;
  }

  function isValidAt(grid, row, column, number) {
    for (let i = 0; i < SIZE; i += 1) {
      if (grid[row][i] === number || grid[i][column] === number) return false;
    }
    const boxRow = Math.floor(row / BOX) * BOX;
    const boxColumn = Math.floor(column / BOX) * BOX;
    for (let r = boxRow; r < boxRow + BOX; r += 1) {
      for (let c = boxColumn; c < boxColumn + BOX; c += 1) {
        if (grid[r][c] === number) return false;
      }
    }
    return true;
  }

  function makePuzzle(difficulty) {
    solution = makeSolution();
    puzzle = solution.map((row) => [...row]);
    const positions = shuffle(Array.from({ length: SIZE * SIZE }, (_, index) => index));
    let removed = 0;
    for (const position of positions) {
      if (removed >= TARGET_EMPTY[difficulty]) break;
      const row = Math.floor(position / SIZE);
      const column = position % SIZE;
      const value = puzzle[row][column];
      puzzle[row][column] = 0;
      if (countSolutions(puzzle.map((line) => [...line])) === 1) {
        removed += 1;
      } else {
        puzzle[row][column] = value;
      }
    }
  }

  function createBoard() {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < SIZE * SIZE; index += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `第 ${Math.floor(index / SIZE) + 1} 行，第 ${index % SIZE + 1} 列`);
      if ((index % SIZE) === 2 || (index % SIZE) === 5) cell.classList.add("box-right");
      if ((Math.floor(index / SIZE) === 2) || (Math.floor(index / SIZE) === 5)) cell.classList.add("box-bottom");
      cell.addEventListener("click", () => selectCell(index));
      cells.push(cell);
      fragment.append(cell);
    }
    boardElement.append(fragment);
  }

  function selectCell(index) {
    selected = index;
    renderBoard();
    if (puzzle[Math.floor(index / SIZE)][index % SIZE] !== 0) {
      hintElement.textContent = "这是题目数字，选一个空格继续。";
    } else {
      hintElement.textContent = "输入数字，或按 N 开启笔记模式。";
    }
  }

  function renderBoard() {
    const selectedRow = selected < 0 ? -1 : Math.floor(selected / SIZE);
    const selectedColumn = selected < 0 ? -1 : selected % SIZE;
    const selectedValue = selected < 0 ? 0 : values[selectedRow][selectedColumn];
    const conflicts = new Set();

    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        const value = values[row][column];
        if (!value) continue;
        const index = row * SIZE + column;
        for (let other = 0; other < SIZE; other += 1) {
          if (other !== column && values[row][other] === value) conflicts.add(index);
          if (other !== row && values[other][column] === value) conflicts.add(index);
        }
        const boxRow = Math.floor(row / BOX) * BOX;
        const boxColumn = Math.floor(column / BOX) * BOX;
        for (let r = boxRow; r < boxRow + BOX; r += 1) {
          for (let c = boxColumn; c < boxColumn + BOX; c += 1) {
            if ((r !== row || c !== column) && values[r][c] === value) conflicts.add(index);
          }
        }
      }
    }

    for (let index = 0; index < cells.length; index += 1) {
      const row = Math.floor(index / SIZE);
      const column = index % SIZE;
      const cell = cells[index];
      const value = values[row][column];
      cell.classList.toggle("given", puzzle[row][column] !== 0);
      cell.classList.toggle("user-value", puzzle[row][column] === 0 && value !== 0);
      cell.classList.toggle("selected", index === selected);
      cell.classList.toggle("peer", selected >= 0 && index !== selected &&
        (row === selectedRow || column === selectedColumn ||
          (Math.floor(row / BOX) === Math.floor(selectedRow / BOX) &&
           Math.floor(column / BOX) === Math.floor(selectedColumn / BOX))));
      cell.classList.toggle("same-number", selectedValue !== 0 && value === selectedValue && index !== selected);
      const incorrect = checkShown && value !== 0 && value !== solution[row][column];
      cell.classList.toggle("error", conflicts.has(index) || incorrect);
      cell.classList.toggle("related-error", (conflicts.has(index) || incorrect) && selected >= 0 &&
        (row === selectedRow || column === selectedColumn));

      if (value) {
        cell.innerHTML = `<span class="cell-value">${value}</span>`;
        cell.setAttribute("aria-label", `第 ${row + 1} 行，第 ${column + 1} 列，${puzzle[row][column] ? "题目数字" : "已填"} ${value}${conflicts.has(index) ? "，有冲突" : ""}`);
      } else if (notes[index].size > 0) {
        const noteGrid = document.createElement("span");
        noteGrid.className = "notes-grid";
        noteGrid.setAttribute("aria-hidden", "true");
        for (let number = 1; number <= SIZE; number += 1) {
          const note = document.createElement("span");
          note.textContent = notes[index].has(number) ? String(number) : "";
          noteGrid.append(note);
        }
        cell.replaceChildren(noteGrid);
        cell.setAttribute("aria-label", `第 ${row + 1} 行，第 ${column + 1} 列，笔记 ${[...notes[index]].sort().join(", ")}`);
      } else {
        cell.textContent = "";
        cell.setAttribute("aria-label", `第 ${row + 1} 行，第 ${column + 1} 列，空格`);
      }
    }

    updateProgress();
    updateNumberPad();
  }

  function updateProgress() {
    const filled = values.flat().filter(Boolean).length;
    document.querySelector("#progress-label").textContent = `${filled} / 81`;
    document.querySelector("#progress-bar").style.width = `${(filled / 81) * 100}%`;
  }

  function updateNumberPad() {
    const remaining = Array.from({ length: SIZE }, (_, index) =>
      values.flat().filter((value) => value === index + 1).length,
    );
    numberPad.querySelectorAll("button").forEach((button) => {
      const count = remaining[Number(button.dataset.number) - 1];
      button.disabled = count >= SIZE;
      button.setAttribute("aria-label", `${button.dataset.number}${count >= SIZE ? "，已全部填入" : ""}`);
    });
  }

  function enterNumber(number) {
    if (gameComplete || selected < 0) {
      hintElement.textContent = "先選一個空格，再輸入數字。";
      return;
    }
    const row = Math.floor(selected / SIZE);
    const column = selected % SIZE;
    if (puzzle[row][column] !== 0) {
      hintElement.textContent = "題目數字不能修改，請選擇空格。";
      return;
    }

    if (noteMode) {
      if (values[row][column] !== 0) return;
      if (notes[selected].has(number)) notes[selected].delete(number);
      else notes[selected].add(number);
    } else {
      const previous = values[row][column];
      values[row][column] = number;
      notes[selected].clear();
      if (number !== solution[row][column] && number !== previous) {
        mistakes += 1;
        document.querySelector("#mistakes").innerHTML = `${mistakes}<span class="stat-unit"> 次</span>`;
        hintElement.textContent = "不太對，再試一次也沒關係。";
      } else {
        hintElement.textContent = "很好，接着找下一个数字。";
      }
    }

    renderBoard();
    if (isSolved()) finishGame();
  }

  function eraseSelected() {
    if (gameComplete || selected < 0) return;
    const row = Math.floor(selected / SIZE);
    const column = selected % SIZE;
    if (puzzle[row][column] !== 0) {
      hintElement.textContent = "題目數字不能擦除。";
      return;
    }
    values[row][column] = 0;
    notes[selected].clear();
    renderBoard();
    hintElement.textContent = "已擦除当前格。";
  }

  function isSolved() {
    return values.every((row, rowIndex) => row.every((value, columnIndex) => value === solution[rowIndex][columnIndex]));
  }

  function finishGame() {
    gameComplete = true;
    window.clearInterval(timerId);
    document.querySelector("#win-time").textContent = formatTime(elapsedSeconds);
    document.querySelector("#win-modal").hidden = false;
    document.querySelector("#play-again").focus();
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function setNoteMode(enabled) {
    noteMode = enabled;
    const button = document.querySelector("#notes-toggle");
    button.classList.toggle("active", noteMode);
    button.setAttribute("aria-pressed", String(noteMode));
    hintElement.textContent = noteMode ? "笔记模式已开启，选择候选数字。" : "笔记模式已关闭。";
  }

  function showToast(message) {
    toastElement.textContent = message;
    toastElement.classList.add("visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toastElement.classList.remove("visible"), 2200);
  }

  function checkBoard() {
    if (gameComplete) return;
    checkShown = true;
    let wrong = 0;
    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        if (puzzle[row][column] === 0 && values[row][column] !== 0 &&
            values[row][column] !== solution[row][column]) wrong += 1;
      }
    }
    if (wrong > 0) {
      hintElement.textContent = `有 ${wrong} 个数字不正确，看看标红的格子。`;
      showToast(`还有 ${wrong} 个数字需要调整`);
    } else if (values.flat().every(Boolean)) {
      finishGame();
    } else {
      hintElement.textContent = "目前填写正确，继续完成剩余空格吧。";
      showToast("目前填写正确，继续加油");
    }
    renderBoard();
  }

  function giveHint() {
    if (gameComplete) return;
    if (selected < 0) {
      hintElement.textContent = "先选一个空格，再查看提示。";
      return;
    }
    const row = Math.floor(selected / SIZE);
    const column = selected % SIZE;
    if (puzzle[row][column] !== 0) {
      hintElement.textContent = "这是题目数字，选择一个空格获取提示。";
      return;
    }
    values[row][column] = solution[row][column];
    notes[selected].clear();
    hintElement.textContent = "已为你填入正确数字，继续吧。";
    renderBoard();
    if (isSolved()) finishGame();
  }

  function startGame() {
    window.clearInterval(timerId);
    makePuzzle(document.querySelector("#difficulty").value);
    values = puzzle.map((row) => [...row]);
    notes = Array.from({ length: SIZE * SIZE }, () => new Set());
    selected = -1;
    mistakes = 0;
    elapsedSeconds = 0;
    gameComplete = false;
    checkShown = false;
    document.querySelector("#mistakes").innerHTML = '0<span class="stat-unit"> 次</span>';
    document.querySelector("#timer").textContent = "00:00";
    document.querySelector("#win-modal").hidden = true;
    setNoteMode(false);
    hintElement.textContent = "选中格子后，输入数字开始游戏。";
    timerId = window.setInterval(() => {
      if (gameComplete) return;
      elapsedSeconds += 1;
      document.querySelector("#timer").textContent = formatTime(elapsedSeconds);
    }, 1000);
    renderBoard();
  }

  function restartGame() {
    if (solution.length === 0) return;
    values = puzzle.map((row) => [...row]);
    notes = Array.from({ length: SIZE * SIZE }, () => new Set());
    selected = -1;
    mistakes = 0;
    elapsedSeconds = 0;
    gameComplete = false;
    checkShown = false;
    document.querySelector("#mistakes").innerHTML = '0<span class="stat-unit"> 次</span>';
    document.querySelector("#timer").textContent = "00:00";
    document.querySelector("#win-modal").hidden = true;
    setNoteMode(false);
    hintElement.textContent = "重新开始了，祝你玩得愉快。";
    window.clearInterval(timerId);
    timerId = window.setInterval(() => {
      elapsedSeconds += 1;
      document.querySelector("#timer").textContent = formatTime(elapsedSeconds);
    }, 1000);
    renderBoard();
  }

  document.querySelector("#new-game").addEventListener("click", startGame);
  document.querySelector("#difficulty").addEventListener("change", startGame);
  document.querySelector("#restart").addEventListener("click", restartGame);
  document.querySelector("#notes-toggle").addEventListener("click", () => setNoteMode(!noteMode));
  document.querySelector("#erase").addEventListener("click", eraseSelected);
  document.querySelector("#hint").addEventListener("click", giveHint);
  document.querySelector("#check").addEventListener("click", checkBoard);
  document.querySelector("#play-again").addEventListener("click", startGame);
  numberPad.addEventListener("click", (event) => {
    const button = event.target.closest("[data-number]");
    if (button) enterNumber(Number(button.dataset.number));
  });
  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLSelectElement) return;
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      enterNumber(Number(event.key));
    } else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      eraseSelected();
    } else if (event.key.toLowerCase() === "n") {
      setNoteMode(!noteMode);
    } else if (event.key.toLowerCase() === "h") {
      giveHint();
    } else if (event.key === "Enter") {
      checkBoard();
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const current = selected < 0 ? 40 : selected;
      const offsets = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
      const next = Math.max(0, Math.min(80, current + offsets[event.key]));
      selectCell(next);
      cells[next].focus();
    } else if (event.key === "Escape") {
      document.querySelector("#win-modal").hidden = true;
    }
  });

  createBoard();
  startGame();
})();
