const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');
const generateBtn = document.getElementById('btn-generate');
const solveBtn = document.getElementById('btn-solve');
const resetBtn = document.getElementById('btn-reset');
const statusDisplay = document.getElementById('status-text');
const stepDisplay = document.getElementById('steps-count');
const speedInput = document.getElementById('speed-range');
const sizeInput = document.getElementById('size-range');
const methodSelect = document.getElementById('algo-select');

let cols = 25;
let rows = 25;
let cellSize;
let animationId;
let currentStep = 0;
let lastTime = 0;

const BG_COLOR = '#0B0E14';
const WALL_COLOR = '#161B22';
const CELL_COLOR = '#0B0E14';
const GEN_COLOR = '#7000FF';
const SOLVE_COLOR = '#00F0FF';
const PATH_COLOR = '#39FF14';
const START_COLOR = '#00F0FF';
const END_COLOR = '#FF0055';
const OPEN_COLOR = 'rgba(0, 255, 100, 0.2)';
const VISITED_COLOR = 'rgba(0, 240, 255, 0.1)';

let grid = [];
let currentCell;
let stack = [];
let generating = false;
let solving = false;
let openSet = [];
let cameFrom = new Map();
let path = [];

class Cell {
    constructor(c, r) {
        this.c = c;
        this.r = r;
        this.walls = [true, true, true, true];
        this.visited = false;
        this.checked = false;
        this.f = 0;
        this.g = 0;
        this.h = 0;
    }

    findNeighbors() {
        let neighbors = [];
        let top = grid[getIndex(this.c, this.r - 1)];
        let right = grid[getIndex(this.c + 1, this.r)];
        let bottom = grid[getIndex(this.c, this.r + 1)];
        let left = grid[getIndex(this.c - 1, this.r)];

        if (top && !top.visited) neighbors.push(top);
        if (right && !right.visited) neighbors.push(right);
        if (bottom && !bottom.visited) neighbors.push(bottom);
        if (left && !left.visited) neighbors.push(left);

        if (neighbors.length > 0) {
            let r = Math.floor(Math.random() * neighbors.length);
            return neighbors[r];
        }
        return undefined;
    }

    getPaths() {
        let neighbors = [];
        let top = grid[getIndex(this.c, this.r - 1)];
        let right = grid[getIndex(this.c + 1, this.r)];
        let bottom = grid[getIndex(this.c, this.r + 1)];
        let left = grid[getIndex(this.c - 1, this.r)];

        if (top && !this.walls[0]) neighbors.push(top);
        if (right && !this.walls[1]) neighbors.push(right);
        if (bottom && !this.walls[2]) neighbors.push(bottom);
        if (left && !this.walls[3]) neighbors.push(left);

        return neighbors;
    }

    show(color) {
        let x = this.c * cellSize;
        let y = this.r * cellSize;

        if (this.visited) {
            ctx.fillStyle = CELL_COLOR;
            ctx.fillRect(x, y, cellSize, cellSize);
        }

        ctx.strokeStyle = '#2d3845';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();

        if (this.walls[0]) { ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); }
        if (this.walls[1]) { ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); }
        if (this.walls[2]) { ctx.moveTo(x + cellSize, y + cellSize); ctx.lineTo(x, y + cellSize); }
        if (this.walls[3]) { ctx.moveTo(x, y + cellSize); ctx.lineTo(x, y); }

        ctx.stroke();

        if (color) {
            ctx.fillStyle = color;
            let p = 2;
            ctx.fillRect(x + p, y + p, cellSize - p * 2, cellSize - p * 2);
        }
    }
}

function getIndex(c, r) {
    if (c < 0 || r < 0 || c > cols - 1 || r > rows - 1) return -1;
    return c + r * cols;
}

function breakWalls(a, b) {
    let x = a.c - b.c;
    if (x === 1) { a.walls[3] = false; b.walls[1] = false; }
    else if (x === -1) { a.walls[1] = false; b.walls[3] = false; }

    let y = a.r - b.r;
    if (y === 1) { a.walls[0] = false; b.walls[2] = false; }
    else if (y === -1) { a.walls[2] = false; b.walls[0] = false; }
}

function handleResize() {
    const w = document.getElementById('app-container').clientWidth - 64;
    const s = Math.min(w, 500);
    canvas.width = s;
    canvas.height = s;
    cellSize = canvas.width / cols;

    if (grid.length > 0) {
        render();
        if (!generating && !solving) {
            grid[0].show(START_COLOR);
            grid[grid.length - 1].show(END_COLOR);
        }
    }
}

function init() {
    cols = parseInt(sizeInput.value);
    rows = parseInt(sizeInput.value);
    handleResize();

    grid = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            grid.push(new Cell(c, r));
        }
    }

    render();
    statusDisplay.innerText = 'Ready';
    currentStep = 0;
    if (stepDisplay) stepDisplay.innerText = currentStep;

    solveBtn.disabled = true;
    canvas.classList.remove('solved');
}

function render() {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < grid.length; i++) {
        grid[i].show();
    }
}

function generateMaze() {
    if (generating || solving) return;
    init();
    generating = true;
    generateBtn.disabled = true;
    solveBtn.disabled = true;
    sizeInput.disabled = true;
    statusDisplay.innerText = 'Generating...';

    currentCell = grid[0];
    currentCell.visited = true;
    stack = [];

    loopGen();
}

function loopGen() {
    if (!generating) return;

    let spd = parseInt(speedInput.value);
    let loops = 1;
    if (spd > 7) loops = (spd - 6) * 2;

    if (spd < 4 && Math.random() > (spd * 0.3)) {
        animationId = requestAnimationFrame(loopGen);
        return;
    }

    for (let k = 0; k < loops; k++) {
        let next = currentCell.findNeighbors();
        if (next) {
            next.visited = true;
            stack.push(currentCell);
            breakWalls(currentCell, next);
            currentCell = next;
        } else if (stack.length > 0) {
            currentCell = stack.pop();
        } else {
            generating = false;
            generateBtn.disabled = false;
            solveBtn.disabled = false;
            sizeInput.disabled = false;
            statusDisplay.innerText = 'Generated';
            render();
            grid[0].show(START_COLOR);
            grid[grid.length - 1].show(END_COLOR);
            return;
        }
    }

    render();
    currentCell.show(GEN_COLOR);
    animationId = requestAnimationFrame(loopGen);
}

function solveMaze() {
    if (generating || solving) return;
    solving = true;
    generateBtn.disabled = true;
    solveBtn.disabled = true;
    sizeInput.disabled = true;

    let type = methodSelect.value;
    statusDisplay.innerText = type === 'astar' ? 'Solving (A*)...' : 'Solving (BFS)...';
    currentStep = 0;

    for (let c of grid) {
        c.checked = false;
        c.f = 0;
        c.g = 0;
        c.h = 0;
    }

    let start = grid[0];
    let end = grid[grid.length - 1];

    openSet = [start];
    cameFrom = new Map();

    start.checked = true;
    start.h = Math.abs(start.c - end.c) + Math.abs(start.r - end.r);
    start.f = start.h;

    loopSolve(type, end);
}

function loopSolve(type, end) {
    if (!solving) return;

    let spd = parseInt(speedInput.value);
    let iter = 1;

    if (spd <= 5) {
        if (!lastTime) lastTime = Date.now();
        let now = Date.now();
        if (now - lastTime < (6 - spd) * 50) {
            animationId = requestAnimationFrame(() => loopSolve(type, end));
            return;
        }
        lastTime = now;
    } else {
        iter = Math.max(1, (spd - 5) * 2);
    }

    for (let k = 0; k < iter; k++) {
        if (openSet.length > 0) {
            let curr;
            if (type === 'astar') {
                let idx = 0;
                for (let i = 0; i < openSet.length; i++) {
                    if (openSet[i].f < openSet[idx].f) idx = i;
                }
                curr = openSet[idx];

                if (curr === end) {
                    finishSolve();
                    return;
                }

                openSet.splice(idx, 1);
                curr.checked = true;
            } else {
                curr = openSet.shift();
                if (curr === end) {
                    finishSolve();
                    return;
                }
            }

            currentStep++;
            stepDisplay.innerText = currentStep;

            let neighbors = curr.getPaths();
            for (let n of neighbors) {
                if (type === 'astar') {
                    if (!n.checked && !openSet.includes(n)) {
                        cameFrom.set(n, curr);
                        n.g = curr.g + 1;
                        n.h = Math.abs(n.c - end.c) + Math.abs(n.r - end.r);
                        n.f = n.g + n.h;
                        openSet.push(n);
                    }
                } else {
                    if (!n.checked) {
                        n.checked = true;
                        cameFrom.set(n, curr);
                        openSet.push(n);
                    }
                }
            }
        } else {
            solving = false;
            statusDisplay.innerText = 'No Path';
            generateBtn.disabled = false;
            resetBtn.disabled = false;
            sizeInput.disabled = false;
            return;
        }
    }

    render();
    grid[0].show(START_COLOR);
    grid[grid.length - 1].show(END_COLOR);

    for (let c of grid) {
        if (c.checked) c.show(VISITED_COLOR);
    }

    if (type === 'astar') {
        for (let c of openSet) c.show(OPEN_COLOR);
    }

    animationId = requestAnimationFrame(() => loopSolve(type, end));
}

function finishSolve() {
    let end = grid[grid.length - 1];
    let temp = end;
    let finalPath = [];
    while (temp) {
        finalPath.push(temp);
        temp = cameFrom.get(temp);
    }
    path = finalPath.reverse();

    let idx = 0;
    let spd = parseInt(speedInput.value);

    function drawPath() {
        if (idx >= path.length) {
            solving = false;
            statusDisplay.innerText = `Solved! Length: ${path.length}`;
            canvas.classList.add('solved');
            generateBtn.disabled = false;
            solveBtn.disabled = true;
            sizeInput.disabled = false;
            return;
        }

        let c = path[idx];
        let x = c.c * cellSize;
        let y = c.r * cellSize;

        ctx.fillStyle = 'rgba(57, 255, 20, 0.2)';
        ctx.fillRect(x, y, cellSize, cellSize);

        if (idx > 0) {
            let prev = path[idx - 1];
            let half = cellSize / 2;

            ctx.beginPath();
            ctx.strokeStyle = PATH_COLOR;
            ctx.lineWidth = cellSize / 4;
            ctx.lineCap = 'round';
            ctx.moveTo(prev.c * cellSize + half, prev.r * cellSize + half);
            ctx.lineTo(c.c * cellSize + half, c.r * cellSize + half);
            ctx.stroke();

            ctx.fillStyle = PATH_COLOR;
            ctx.beginPath();
            ctx.arc(c.c * cellSize + half, c.r * cellSize + half, cellSize / 8, 0, Math.PI * 2);
            ctx.fill();
        }

        idx++;
        if (spd < 3) requestAnimationFrame(drawPath);
        else {
            if (idx < path.length) drawPath();
            else requestAnimationFrame(drawPath);
        }
    }
    drawPath();
}

generateBtn.addEventListener('click', generateMaze);
solveBtn.addEventListener('click', solveMaze);
resetBtn.addEventListener('click', () => {
    cancelAnimationFrame(animationId);
    generating = false;
    solving = false;
    generateBtn.disabled = false;
    sizeInput.disabled = false;
    init();
});

sizeInput.addEventListener('input', () => {
    if (!generating && !solving) init();
});

window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (!generating && !solving) init();
        else handleResize();
    }, 100);
});

init();
