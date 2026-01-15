/**
 * Maze Solver AI
 * Implements Recursive Backtracker for generation and BFS for pathfinding.
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

// Configuration
let COLS = 25;
let ROWS = 25;
let CELL_SIZE; // Calculated dynamically
let ANIMATION_SPEED_GEN = 1;
let ANIMATION_SPEED_SOLVE = 1;
let SPEED_MULTIPLIER = 1; // Controlled by slider

// Colors
const COLOR_BG = '#0B0E14';
const COLOR_WALL = '#161B22'; // Not used directly, walls are lines
const COLOR_WALL_LINE = '#1F2933'; // Dark grey
const COLOR_CELL_BG = '#0B0E14';
const COLOR_VISITED_GEN = 'rgba(112, 0, 255, 0.1)';
const COLOR_HEAD_GEN = '#7000FF'; // Purple
const COLOR_VISITED_SOLVE = 'rgba(0, 240, 255, 0.1)';
const COLOR_HEAD_SOLVE = '#00F0FF'; // Cyan
const COLOR_PATH = '#39FF14'; // Neon Green
const COLOR_START = '#00F0FF'; // Green-ish Cyan
const COLOR_END = '#FF0055'; // Red-ish Pink

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

class Cell {
    constructor(i, j) {
        this.i = i;
        this.j = j;
        this.walls = [true, true, true, true]; // Top, Right, Bottom, Left
        this.visited = false; // For generation
        this.searched = false; // For solving
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

        // Debug: Visualize Generation Visited
        // if (this.visited) { ctx.fillStyle = COLOR_VISITED_GEN; ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE); }

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
    // We want a square canvas that fits
    const containerWidth = document.getElementById('app-container').clientWidth - 64; // roughly padding
    // Limit max size
    const size = Math.min(containerWidth, 500);

    canvas.width = size;
    canvas.height = size;

    // Recalculate cell size
    CELL_SIZE = canvas.width / COLS;

    // Redraw if grid exists
    if (grid.length > 0) {
        drawGrid();
        if (!isGenerating && !isSolving) drawStartEnd();

        // Re-draw solved path if exists
        if (canvas.classList.contains('solved') && solvedPath.length > 0) {
            // Re-drawing path requires logic or just clearing; 
            // simpler to just let user re-solve if they resize massively
            // but we can try to redraw the grid state.
        }
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

    // Only update stepsCount if it exists (it was missing from my previous file snippet, assuming safety)
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
    statusText.innerText = 'Generating Maze...';

    current = grid[0];
    current.visited = true;
    stack = [];

    animateGeneration();
}

function animateGeneration() {
    if (!isGenerating) return;

    // Calculate loops per frame based on speed
    // Slider 1-10. 
    // 1-3: Slow (1 step per frame or skip frames)
    // 4-7: Normal (1-2 steps per frame)
    // 8-10: Fast (multiple steps)

    let speedVal = parseInt(speedRange.value);
    let loops = 1;

    if (speedVal > 7) loops = (speedVal - 6) * 2; // 8->4, 10->8
    else if (speedVal < 4) {
        // Slow down by skipping frames? 
        // Simple hack: Random skip
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
            statusText.innerText = 'Maze Generated';
            drawGrid(); // Final clean draw
            drawStartEnd();
            return;
        }
    }

    // Draw Update
    drawGrid();

    // Highlight current head
    current.drawHighlight(COLOR_HEAD_GEN);

    animationFrameId = requestAnimationFrame(animateGeneration);
}

function drawStartEnd() {
    // Start (Top Left)
    grid[0].drawHighlight(COLOR_START);
    // End (Bottom Right)
    grid[grid.length - 1].drawHighlight(COLOR_END);
}


// --- BFS Solver --- //

function startSolving() {
    if (isGenerating || isSolving) return;
    isSolving = true;
    btnGenerate.disabled = true;
    btnSolve.disabled = true;
    statusText.innerText = 'Solving (BFS)...';
    steps = 0;

    // Reset search state
    for (let cell of grid) {
        cell.searched = false;
    }

    let start = grid[0];
    let end = grid[grid.length - 1];

    solverQueue = [start];
    solverCameFrom = new Map();
    solverCameFrom.set(start, null);
    start.searched = true;

    animateSolver();
}

function animateSolver() {
    if (!isSolving) return;

    // BFS Step
    let found = false;
    let currentSearch = null;

    let speedVal = parseInt(speedRange.value);
    let loops = 1;
    if (speedVal > 7) loops = (speedVal - 6) * 3;
    else if (speedVal < 4) {
        if (Math.random() > (speedVal * 0.3)) {
            animationFrameId = requestAnimationFrame(animateSolver);
            return;
        }
    }

    // Multiple steps per frame for speed
    for (let k = 0; k < loops; k++) {
        if (solverQueue.length > 0) {
            currentSearch = solverQueue.shift();
            steps++;
            stepsCount.innerText = steps;

            if (currentSearch === grid[grid.length - 1]) {
                found = true;
                break;
            }

            let neighbors = currentSearch.getAccessibleNeighbors();
            for (let neighbor of neighbors) {
                if (!neighbor.searched) {
                    neighbor.searched = true;
                    solverCameFrom.set(neighbor, currentSearch);
                    solverQueue.push(neighbor);
                }
            }
        } else {
            // No solution (shouldn't happen in perfect maze)
            isSolving = false;
            statusText.innerText = 'No Path Found';
            btnGenerate.disabled = false;
            btnReset.disabled = false;
            return;
        }
    }

    // Draw Update
    drawGrid();
    drawStartEnd();

    // Draw all searched cells
    // Optimization: Don't redraw everything, just draw overlay? 
    // For simplicity, we redraw grid then overlay.
    // Ideally we'd maintain an image buffer but this is small enough.

    // Draw visited set for visualization
    for (let cell of grid) {
        if (cell.searched) {
            cell.drawHighlight(COLOR_VISITED_SOLVE);
        }
    }

    if (currentSearch) {
        currentSearch.drawHighlight(COLOR_HEAD_SOLVE);
    }

    if (found) {
        reconstructPath();
        return;
    }

    animationFrameId = requestAnimationFrame(animateSolver);
}

function reconstructPath() {
    let end = grid[grid.length - 1];
    let path = [];
    let curr = end;
    while (curr !== null) {
        path.push(curr);
        curr = solverCameFrom.get(curr);
    }
    path.reverse();
    solvedPath = path; // Store for potential redraws

    // Animate Path Drawing
    let pathIndex = 0;
    let speedVal = parseInt(speedRange.value); // Read speed for path animation

    function animatePath() {
        if (pathIndex >= path.length) {
            isSolving = false;
            statusText.innerText = `Solved! Path Length: ${path.length}`;
            canvas.classList.add('solved');
            btnGenerate.disabled = false;
            btnSolve.disabled = true; // Already solved

            // Draw arrowhead at the end
            let endCell = path[path.length - 1];
            let prevCell = path[path.length - 2];
            if (endCell && prevCell) {
                // simple direction check
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
        // cell.drawHighlight(COLOR_PATH); // Removed full block highlight for clearer path

        // Use a smaller glow for the path node
        let x = cell.i * CELL_SIZE;
        let y = cell.j * CELL_SIZE;
        ctx.fillStyle = 'rgba(57, 255, 20, 0.2)'; // Faint green glow
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // Connect lines visually (center to center)
        if (pathIndex > 0) {
            let prev = path[pathIndex - 1];
            ctx.beginPath();
            ctx.strokeStyle = COLOR_PATH;
            ctx.lineWidth = CELL_SIZE / 4; // Thicker line
            ctx.lineCap = 'round';
            ctx.moveTo(prev.i * CELL_SIZE + CELL_SIZE / 2, prev.j * CELL_SIZE + CELL_SIZE / 2);
            ctx.lineTo(cell.i * CELL_SIZE + CELL_SIZE / 2, cell.j * CELL_SIZE + CELL_SIZE / 2);
            ctx.stroke();

            // Draw a small dot at the joint to make it smooth
            ctx.fillStyle = COLOR_PATH;
            ctx.beginPath();
            ctx.arc(cell.i * CELL_SIZE + CELL_SIZE / 2, cell.j * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 8, 0, Math.PI * 2);
            ctx.fill();
        }

        if (speedVal < 10) {
            // Constant drawing usually, but for path let's keep it smooth
        }

        pathIndex++;
        requestAnimationFrame(animatePath);
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
    setup(); // Will use current slider value
});

// Update grid on size change (only if not running)
sizeRange.addEventListener('input', () => {
    if (!isGenerating && !isSolving) {
        setup();
    }
});

// Window Resize
window.addEventListener('resize', () => {
    // Debounce slightly
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (!isGenerating && !isSolving) {
            setup(); // Full reset on resize to be safe
        } else {
            // Just resize canvas and redraw grid pixels
            resizeCanvas();
        }
    }, 100);
});


// Init
setup();
