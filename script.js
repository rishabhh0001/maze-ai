/**
 * Maze Solver AI
 * Implements Recursive Backtracker for generation and BFS/A* for pathfinding.
 */

const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');
const btnGenerate = document.getElementById('btn-generate');
const btnSolve = document.getElementById('btn-solve');
const btnReset = document.getElementById('btn-reset');
const statusText = document.getElementById('status-text');
const stepsCount = document.getElementById('steps-count');

const speedRange = document.getElementById('speed-range');
const sizeRange = document.getElementById('size-range');
const algoSelect = document.getElementById('algo-select');

// Configuration
let COLS = 25;
let ROWS = 25;
let CELL_SIZE; // Calculated dynamically
let ANIMATION_SPEED_GEN = 1;

// Colors
const COLOR_BG = '#0B0E14';
const COLOR_WALL = '#161B22';
const COLOR_CELL_BG = '#0B0E14';
const COLOR_VISITED_GEN = 'rgba(112, 0, 255, 0.1)';
const COLOR_HEAD_GEN = '#7000FF'; // Purple
const COLOR_VISITED_SOLVE = 'rgba(0, 240, 255, 0.1)';
const COLOR_HEAD_SOLVE = '#00F0FF'; // Cyan
const COLOR_PATH = '#39FF14'; // Neon Green
const COLOR_START = '#00F0FF'; // Green-ish Cyan
const COLOR_END = '#FF0055'; // Red-ish Pink
const COLOR_OPEN_SET = 'rgba(0, 255, 100, 0.2)'; // Greenish frontier for A*

// State
let grid = [];
let current; // Current cell for generation
let stack = []; // For recursive backtracker
let isGenerating = false;
let isSolving = false;
let solverQueue = [];
let solverCameFrom = new Map(); // For path reconstruction
let solvedPath = [];
let animationFrameId;
let steps = 0;
let lastSolverTime = 0; // Fix for timing simulation

class Cell {
    constructor(i, j) {
        this.i = i;
        this.j = j;
        this.walls = [true, true, true, true]; // Top, Right, Bottom, Left
        this.visited = false; // For generation
        this.searched = false; // For solving (Closed Set in A*)
        this.f = 0; // A* Total cost
        this.g = 0; // A* Cost from start
        this.h = 0; // A* Heuristic to end
    }

    // Check neighbors for generation (Grid based)
    checkNeighbors() {
        let neighbors = [];
        let top = grid[index(this.i, this.j - 1)];
        let right = grid[index(this.i + 1, this.j)];
        let bottom = grid[index(this.i, this.j + 1)];
        let left = grid[index(this.i - 1, this.j)];

        if (top && !top.visited) neighbors.push(top);
        if (right && !right.visited) neighbors.push(right);
        if (bottom && !bottom.visited) neighbors.push(bottom);
        if (left && !left.visited) neighbors.push(left);

        if (neighbors.length > 0) {
            let r = Math.floor(Math.random() * neighbors.length);
            return neighbors[r];
        } else {
            return undefined;
        }
    }

    // Get accessible neighbors for solving (Wall based)
    getAccessibleNeighbors() {
        let neighbors = [];
        let top = grid[index(this.i, this.j - 1)];
        let right = grid[index(this.i + 1, this.j)];
        let bottom = grid[index(this.i, this.j + 1)];
        let left = grid[index(this.i - 1, this.j)];

        // Note: walls order is [Top, Right, Bottom, Left]
        if (top && !this.walls[0]) neighbors.push(top);
        if (right && !this.walls[1]) neighbors.push(right);
        if (bottom && !this.walls[2]) neighbors.push(bottom);
        if (left && !this.walls[3]) neighbors.push(left);

        return neighbors;
    }

    draw() {
        let x = this.i * CELL_SIZE;
        let y = this.j * CELL_SIZE;

        // Draw Cell Background (if visited or searched)
        if (this.visited) {
            ctx.fillStyle = COLOR_CELL_BG;
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }

        ctx.strokeStyle = '#2d3845'; // Slightly lighter than background
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Draw Walls
        ctx.beginPath();
        if (this.walls[0]) { ctx.moveTo(x, y); ctx.lineTo(x + CELL_SIZE, y); }
        if (this.walls[1]) { ctx.moveTo(x + CELL_SIZE, y); ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE); }
        if (this.walls[2]) { ctx.moveTo(x + CELL_SIZE, y + CELL_SIZE); ctx.lineTo(x, y + CELL_SIZE); }
        if (this.walls[3]) { ctx.moveTo(x, y + CELL_SIZE); ctx.lineTo(x, y); }
        ctx.stroke();
    }

    drawHighlight(color) {
        let x = this.i * CELL_SIZE;
        let y = this.j * CELL_SIZE;
        ctx.fillStyle = color;
        // Draw slightly smaller to look nice
        let padding = 2;
        ctx.fillRect(x + padding, y + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2);
    }
}

function index(i, j) {
    if (i < 0 || j < 0 || i > COLS - 1 || j > ROWS - 1) return -1;
    return i + j * COLS;
}

function removeWalls(a, b) {
    let x = a.i - b.i;
    if (x === 1) { a.walls[3] = false; b.walls[1] = false; }
    else if (x === -1) { a.walls[1] = false; b.walls[3] = false; }

    let y = a.j - b.j;
    if (y === 1) { a.walls[0] = false; b.walls[2] = false; }
    else if (y === -1) { a.walls[2] = false; b.walls[0] = false; }
}

function resizeCanvas() {
    // Make canvas responsive to container width
    const containerWidth = document.getElementById('app-container').clientWidth - 64;
    const size = Math.min(containerWidth, 500);

    canvas.width = size;
    canvas.height = size;

    // Recalculate cell size
    CELL_SIZE = canvas.width / COLS;

    // Redraw if grid exists
    if (grid.length > 0) {
        drawGrid();
        if (!isGenerating && !isSolving) drawStartEnd();
    }
}

function setup() {
    // Get values from controls
    COLS = parseInt(sizeRange.value);
    ROWS = parseInt(sizeRange.value);

    // Resize first
    resizeCanvas();

    grid = [];
    for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
            let cell = new Cell(i, j);
            grid.push(cell);
        }
    }
    // Draw initial grid
    drawGrid();

    // Initial UI State
    statusText.innerText = 'Ready';
    steps = 0;
    if (stepsCount) stepsCount.innerText = steps;

    btnSolve.disabled = true;
    canvas.classList.remove('solved');
}

function drawGrid() {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < grid.length; i++) {
        grid[i].draw();
    }
}

// --- Maze Generation (Recursive Backtracker) --- //

function startGeneration() {
    if (isGenerating || isSolving) return;
    setup(); // Reset grid
    isGenerating = true;
    btnGenerate.disabled = true;
    btnSolve.disabled = true;
    sizeRange.disabled = true;
    statusText.innerText = 'Generating Maze...';

    current = grid[0];
    current.visited = true;
    stack = [];

    animateGeneration();
}

function animateGeneration() {
    if (!isGenerating) return;

    let speedVal = parseInt(speedRange.value);
    let loops = 1;

    if (speedVal > 7) loops = (speedVal - 6) * 2; // 8->4, 10->8
    else if (speedVal < 4) {
        // Slow down randomly
        if (Math.random() > (speedVal * 0.3)) {
            animationFrameId = requestAnimationFrame(animateGeneration);
            return;
        }
    }

    for (let k = 0; k < loops; k++) {
        // Step 1
        let next = current.checkNeighbors();
        if (next) {
            next.visited = true;
            stack.push(current);
            removeWalls(current, next);
            current = next;
        } else if (stack.length > 0) {
            current = stack.pop();
        } else {
            // Finished
            isGenerating = false;
            btnGenerate.disabled = false;
            btnSolve.disabled = false;
            sizeRange.disabled = false;
            statusText.innerText = 'Maze Generated';
            drawGrid(); // Final clean draw
            drawStartEnd();
            return;
        }
    }

    // Draw Update
    drawGrid();
    current.drawHighlight(COLOR_HEAD_GEN);

    animationFrameId = requestAnimationFrame(animateGeneration);
}

function drawStartEnd() {
    grid[0].drawHighlight(COLOR_START);
    grid[grid.length - 1].drawHighlight(COLOR_END);
}


// --- Pathfinding Solver (BFS & A*) --- //

function startSolving() {
    if (isGenerating || isSolving) return;
    isSolving = true;
    btnGenerate.disabled = true;
    btnSolve.disabled = true;
    sizeRange.disabled = true;

    let algo = algoSelect.value;
    statusText.innerText = `Solving (${algo === 'astar' ? 'A* AI' : 'BFS'})...`;
    steps = 0;

    // Reset search state
    for (let cell of grid) {
        cell.searched = false;
        cell.f = 0;
        cell.g = 0;
        cell.h = 0;
    }

    let start = grid[0];
    let end = grid[grid.length - 1];

    // Initialize standard queue/set for BFS/A*
    solverQueue = [start];
    solverCameFrom = new Map();
    // solverCameFrom.set(start, null); 

    start.searched = true; // "In open set" effectively
    start.g = 0;
    start.h = heuristic(start, end);
    start.f = start.g + start.h;

    animateSolver(algo, end);
}

function heuristic(a, b) {
    // Manhattan distance
    return Math.abs(a.i - b.i) + Math.abs(a.j - b.j);
}

function animateSolver(algo, end) {
    if (!isSolving) return;

    let speedVal = parseInt(speedRange.value);

    // Logic for steps per frame vs frames per step
    // Low speed: Wait X frames before 1 step
    // High speed: Do X steps per 1 frame

    let stepsPerFrame = 1;

    // VERY REALISTIC SLOW MODE for speeds 1-5
    if (speedVal <= 5) {
        // Use a counter attached to the function scope or external?
        // simple timestamp check
        // simple timestamp check
        if (!lastSolverTime) lastSolverTime = Date.now();
        let now = Date.now();
        let delay = (6 - speedVal) * 50; // 50ms to 250ms delay

        if (now - lastSolverTime < delay) {
            animationFrameId = requestAnimationFrame(() => animateSolver(algo, end));
            return;
        }
        lastSolverTime = now;
    } else {
        // Fast
        stepsPerFrame = Math.max(1, (speedVal - 5) * 2);
    }


    for (let k = 0; k < stepsPerFrame; k++) {
        if (solverQueue.length > 0) {

            let currentSearch;

            if (algo === 'astar') {
                // Find lowest F
                let winner = 0;
                for (let i = 0; i < solverQueue.length; i++) {
                    if (solverQueue[i].f < solverQueue[winner].f) {
                        winner = i;
                    }
                }
                currentSearch = solverQueue[winner];

                // End condition
                if (currentSearch === end) {
                    reconstructPath();
                    return;
                }

                // Remove from OpenSet
                solverQueue.splice(winner, 1);
                currentSearch.searched = true; // Closed Set visualization

            } else {
                // BFS
                currentSearch = solverQueue.shift();
                if (currentSearch === end) {
                    reconstructPath();
                    return;
                }
            }

            steps++;
            stepsCount.innerText = steps;

            let neighbors = currentSearch.getAccessibleNeighbors();
            for (let neighbor of neighbors) {
                if (algo === 'astar') {
                    // A* Logic
                    if (!neighbor.searched && !solverQueue.includes(neighbor)) {
                        solverCameFrom.set(neighbor, currentSearch);
                        neighbor.g = currentSearch.g + 1;
                        neighbor.h = heuristic(neighbor, end);
                        neighbor.f = neighbor.g + neighbor.h;
                        solverQueue.push(neighbor);
                    }
                } else {
                    // BFS Logic
                    if (!neighbor.searched) {
                        neighbor.searched = true;
                        solverCameFrom.set(neighbor, currentSearch);
                        solverQueue.push(neighbor);
                    }
                }
            }
        } else {
            // No solution
            isSolving = false;
            statusText.innerText = 'No Path Found';
            btnGenerate.disabled = false;
            btnReset.disabled = false;
            sizeRange.disabled = false;
            return;
        }
    }

    // Draw Update
    drawGrid();
    drawStartEnd();

    // Draw Searched (Closed Set)
    for (let cell of grid) {
        if (cell.searched) {
            cell.drawHighlight(COLOR_VISITED_SOLVE);
        }
    }

    // For A*: Draw Open Set (Frontier)
    if (algo === 'astar') {
        for (let cell of solverQueue) {
            cell.drawHighlight(COLOR_OPEN_SET);
        }
    }

    // Highlight Head
    if (solverQueue.length > 0 && algo !== 'astar') { // BFS head is just last popped? No, last added? 
        // BFS visualizes frontier naturally
    }

    animationFrameId = requestAnimationFrame(() => animateSolver(algo, end));
}

function reconstructPath() {
    let end = grid[grid.length - 1];
    let path = [];
    let curr = end;
    while (curr !== null && curr !== undefined) {
        path.push(curr);
        curr = solverCameFrom.get(curr);
    }
    path.reverse();
    solvedPath = path;

    // Animate Path Drawing
    let pathIndex = 0;
    let speedVal = parseInt(speedRange.value);

    function animatePath() {
        if (pathIndex >= path.length) {
            isSolving = false;
            statusText.innerText = `Solved! Path Length: ${path.length}`;
            canvas.classList.add('solved');
            btnGenerate.disabled = false;
            btnSolve.disabled = true;
            sizeRange.disabled = false;

            // Arrowhead
            let endCell = path[path.length - 1];
            let prevCell = path[path.length - 2];
            if (endCell && prevCell) {
                let cx = endCell.i * CELL_SIZE + CELL_SIZE / 2;
                let cy = endCell.j * CELL_SIZE + CELL_SIZE / 2;
                ctx.fillStyle = COLOR_PATH;
                ctx.beginPath();
                ctx.arc(cx, cy, CELL_SIZE / 4, 0, Math.PI * 2);
                ctx.fill();
            }
            return;
        }

        let cell = path[pathIndex];
        let x = cell.i * CELL_SIZE;
        let y = cell.j * CELL_SIZE;
        ctx.fillStyle = 'rgba(57, 255, 20, 0.2)';
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        if (pathIndex > 0) {
            let prev = path[pathIndex - 1];
            ctx.beginPath();
            ctx.strokeStyle = COLOR_PATH;
            ctx.lineWidth = CELL_SIZE / 4;
            ctx.lineCap = 'round';
            ctx.moveTo(prev.i * CELL_SIZE + CELL_SIZE / 2, prev.j * CELL_SIZE + CELL_SIZE / 2);
            ctx.lineTo(cell.i * CELL_SIZE + CELL_SIZE / 2, cell.j * CELL_SIZE + CELL_SIZE / 2);
            ctx.stroke();

            ctx.fillStyle = COLOR_PATH;
            ctx.beginPath();
            ctx.arc(cell.i * CELL_SIZE + CELL_SIZE / 2, cell.j * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 8, 0, Math.PI * 2);
            ctx.fill();
        }

        pathIndex++;
        // Very fast path drawing unless speed is super low
        if (speedVal < 3) requestAnimationFrame(animatePath);
        else {
            if (pathIndex < path.length) animatePath(); // Instant draw for fast speeds
            else requestAnimationFrame(animatePath);
        }
    }

    animatePath();
}


// Event Listeners
btnGenerate.addEventListener('click', startGeneration);
btnSolve.addEventListener('click', startSolving);
btnReset.addEventListener('click', () => {
    cancelAnimationFrame(animationFrameId);
    isGenerating = false;
    isSolving = false;
    btnGenerate.disabled = false;
    sizeRange.disabled = false;
    setup();
});

sizeRange.addEventListener('input', () => {
    if (!isGenerating && !isSolving) {
        setup();
    }
});

window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (!isGenerating && !isSolving) {
            setup();
        } else {
            resizeCanvas();
        }
    }, 100);
});

// Init
setup();
