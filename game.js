// Game constants
const TILE_SIZE = 40;
let COLS = Math.floor(window.innerWidth / TILE_SIZE);
let ROWS = Math.floor((window.innerHeight - 60) / TILE_SIZE); // 60px for controls
if (COLS % 2 === 0) COLS--; // Keep it odd
if (ROWS % 2 === 0) ROWS--;

const WALL = 1;
const PATH = 0;

// Assets
const tomImg = new Image();
const jerryImg = new Image();
const wallImg = new Image();
const floorImg = new Image();

// Asset state
let assetsLoaded = 0;
const totalAssets = 4;
function checkAssetsLoaded() { assetsLoaded++; if (assetsLoaded === totalAssets) initGame(); }
tomImg.onload = checkAssetsLoaded; jerryImg.onload = checkAssetsLoaded;
wallImg.onload = checkAssetsLoaded; floorImg.onload = checkAssetsLoaded;
tomImg.src = 'assets/tom_new.png';
jerryImg.src = 'assets/jerry_new.png';
wallImg.src = 'assets/wall.png';
floorImg.src = 'assets/floor.png';

// Canvas
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Window Resize Handler
window.addEventListener('resize', () => {
    // Debounce or just reset? Let's reset for simplicity as grid changes
    // Only reset if dimensions changed significantly
    let newCols = Math.floor(window.innerWidth / TILE_SIZE);
    let newRows = Math.floor((window.innerHeight - 60) / TILE_SIZE);
    if (newCols % 2 === 0) newCols--;
    if (newRows % 2 === 0) newRows--;

    if (newCols !== COLS || newRows !== ROWS) {
        COLS = newCols;
        ROWS = newRows;
        newMaze();
    }
});

// State
let grid = [];
let algorithm = 'greedy';
let speed = 10;
let isRunning = false;
let animationId;
let tomPos = { x: 1, y: 1 };
let jerryPos = { x: COLS - 2, y: ROWS - 2 };
let visitedNodes = [];
let finalPath = [];
let swarmParticles = [];

// Leaderboard state
let results = []; // Array of {algo: string, steps: number}

function updateLeaderboard(algo, steps) {
    // Add or Update result
    let existing = results.find(r => r.algo === algo);
    if (existing) {
        existing.steps = steps;
    } else {
        results.push({ algo: algo, steps: steps });
    }

    // Sort: Best (fewest steps) to Worst
    results.sort((a, b) => a.steps - b.steps);

    // Render
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    for (let r of results) {
        let row = document.createElement('tr');
        row.style.borderBottom = '1px solid #dfe6e9';

        let nameCell = document.createElement('td');
        // Beautify name logic
        let name = r.algo.charAt(0).toUpperCase() + r.algo.slice(1);
        if (name === 'Bfs') name = 'BFS';
        if (name === 'Dfs') name = 'DFS';
        if (name === 'Astar') name = 'A*';
        if (name === 'Bidirectional') name = 'Bi-Dir';
        nameCell.innerText = name;
        nameCell.style.padding = '5px 0';

        let stepsCell = document.createElement('td');
        stepsCell.innerText = r.steps;
        stepsCell.style.textAlign = 'right';
        stepsCell.style.fontWeight = 'bold';
        stepsCell.style.color = '#2d3436';

        row.appendChild(nameCell);
        row.appendChild(stepsCell);
        tbody.appendChild(row);
    }

    document.getElementById('leaderboard').style.display = 'block';
}

// Classes

class Maze {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = [];
        this.generate();
    }

    generate() {
        // Init walls
        for (let y = 0; y < this.rows; y++) {
            let row = [];
            for (let x = 0; x < this.cols; x++) row.push(WALL);
            this.grid.push(row);
        }

        // Recursive Backtracker
        this.carve(1, 1);

        // Braid the maze (remove some dead ends to make loops)
        this.braid(0.5); // 50% of dead ends removed

        // Ensure start/end
        this.grid[1][1] = PATH;
        this.grid[this.rows - 2][this.cols - 2] = PATH;
    }

    carve(x, y) {
        const dirs = [{ dx: 0, dy: -2 }, { dx: 0, dy: 2 }, { dx: -2, dy: 0 }, { dx: 2, dy: 0 }].sort(() => Math.random() - 0.5);
        this.grid[y][x] = PATH;
        for (let d of dirs) {
            let nx = x + d.dx, ny = y + d.dy;
            if (nx > 0 && nx < this.cols - 1 && ny > 0 && ny < this.rows - 1 && this.grid[ny][nx] === WALL) {
                this.grid[y + d.dy / 2][x + d.dx / 2] = PATH;
                this.carve(nx, ny);
            }
        }
    }

    braid(factor) {
        // Find dead ends
        for (let y = 1; y < this.rows - 1; y += 2) {
            for (let x = 1; x < this.cols - 1; x += 2) {
                if (this.grid[y][x] === WALL) continue;

                // Count walls around
                let neighbors = [];
                if (this.grid[y - 1][x] === WALL) neighbors.push({ x: x, y: y - 1 }); // Up wall
                if (this.grid[y + 1][x] === WALL) neighbors.push({ x: x, y: y + 1 }); // Down wall
                if (this.grid[y][x - 1] === WALL) neighbors.push({ x: x - 1, y: y }); // Left wall
                if (this.grid[y][x + 1] === WALL) neighbors.push({ x: x + 1, y: y }); // Right wall

                if (neighbors.length === 3 && Math.random() < factor) {
                    // It's a dead end (3 walls). Remove one random wall to connect it.
                    let wall = neighbors[Math.floor(Math.random() * neighbors.length)];
                    if (wall.x > 0 && wall.x < this.cols - 1 && wall.y > 0 && wall.y < this.rows - 1) {
                        this.grid[wall.y][wall.x] = PATH;
                    }
                }
            }
        }
    }

    draw(ctx) {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === WALL) {
                    ctx.drawImage(wallImg, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else {
                    ctx.drawImage(floorImg, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
}

// Algorithms
const Algos = {
    bfs: (grid, start, end) => {
        let queue = [start];
        let visited = new Set([key(start)]);
        let cameFrom = new Map();
        let visitedOrder = [];

        while (queue.length > 0) {
            let curr = queue.shift();
            visitedOrder.push(curr);
            if (curr.x === end.x && curr.y === end.y) return { result: reconstruct(cameFrom, curr), visited: visitedOrder };

            for (let n of getNeighbors(grid, curr)) {
                if (!visited.has(key(n))) {
                    visited.add(key(n));
                    cameFrom.set(key(n), curr);
                    queue.push(n);
                }
            }
        }
        return { result: [], visited: visitedOrder };
    },
    dfs: (grid, start, end) => {
        let stack = [start];
        let visited = new Set([key(start)]);
        let cameFrom = new Map();
        let visitedOrder = [];

        while (stack.length > 0) {
            // DFS nature: pop from end
            let curr = stack.pop();
            visitedOrder.push(curr);

            if (curr.x === end.x && curr.y === end.y) return { result: reconstruct(cameFrom, curr), visited: visitedOrder };

            // Shuffle neighbors for random DFS pathing
            let neighbors = getNeighbors(grid, curr).sort(() => Math.random() - 0.5);
            for (let n of neighbors) {
                if (!visited.has(key(n))) {
                    visited.add(key(n));
                    cameFrom.set(key(n), curr);
                    stack.push(n);
                }
            }
        }
        return { result: [], visited: visitedOrder };
    },
    dijkstra: (grid, start, end) => {
        // Uniform Cost Search equivalent for unweighted graph
        let pq = [{ pos: start, cost: 0 }];
        let costs = new Map();
        costs.set(key(start), 0);
        let cameFrom = new Map();
        let visitedOrder = [];
        let closed = new Set();

        while (pq.length > 0) {
            pq.sort((a, b) => a.cost - b.cost); // Min-heap simulation
            let { pos: curr, cost } = pq.shift();

            if (closed.has(key(curr))) continue;
            closed.add(key(curr));

            visitedOrder.push(curr);

            if (curr.x === end.x && curr.y === end.y) return { result: reconstruct(cameFrom, curr), visited: visitedOrder };

            for (let n of getNeighbors(grid, curr)) {
                let newCost = cost + 1;
                let k = key(n);
                if (!costs.has(k) || newCost < costs.get(k)) {
                    costs.set(k, newCost);
                    cameFrom.set(k, curr);
                    pq.push({ pos: n, cost: newCost });
                }
            }
        }
        return { result: [], visited: visitedOrder };
    },
    astar: (grid, start, end) => {
        let pq = [{ pos: start, cost: 0, prio: heuristic(start, end) }];
        let costs = new Map();
        costs.set(key(start), 0);
        let cameFrom = new Map();
        let visitedOrder = [];
        let closed = new Set();

        while (pq.length > 0) {
            pq.sort((a, b) => a.prio - b.prio);
            let { pos: curr, cost } = pq.shift();

            if (closed.has(key(curr))) continue;
            closed.add(key(curr));

            visitedOrder.push(curr);

            if (curr.x === end.x && curr.y === end.y) return { result: reconstruct(cameFrom, curr), visited: visitedOrder };

            for (let n of getNeighbors(grid, curr)) {
                let newCost = cost + 1;
                let k = key(n);
                if (!costs.has(k) || newCost < costs.get(k)) {
                    costs.set(k, newCost);
                    cameFrom.set(k, curr);
                    pq.push({ pos: n, cost: newCost, prio: newCost + heuristic(n, end) });
                }
            }
        }
        return { result: [], visited: visitedOrder };
    },
    greedy: (grid, start, end) => {
        let pq = [{ pos: start, prio: heuristic(start, end) }];
        let visited = new Set([key(start)]);
        let cameFrom = new Map();
        let visitedOrder = [];

        while (pq.length > 0) {
            pq.sort((a, b) => a.prio - b.prio);
            let { pos: curr } = pq.shift();

            // Note: Greedy doesn't guarantee shortest path, so we don't strictly *need*
            // to process nodes again, but duplicates might exist in PQ.
            // However, our implementation below only adds to PQ if NOT in 'visited'.
            // So duplicates shouldn't occur in this specific implementation.
            // But let's add visitedOrder just for visualization.

            visitedOrder.push(curr);

            if (curr.x === end.x && curr.y === end.y) return { result: reconstruct(cameFrom, curr), visited: visitedOrder };

            for (let n of getNeighbors(grid, curr)) {
                if (!visited.has(key(n))) {
                    visited.add(key(n));
                    cameFrom.set(key(n), curr);
                    pq.push({ pos: n, prio: heuristic(n, end) });
                }
            }
        }
        return { result: [], visited: visitedOrder };
    },
    bidirectional: (grid, start, end) => {
        // Bi-directional BFS
        let qStart = [start];
        let qEnd = [end];
        let visitedStart = new Map(); visitedStart.set(key(start), null);
        let visitedEnd = new Map(); visitedEnd.set(key(end), null);
        let visitedOrder = [];

        while (qStart.length > 0 && qEnd.length > 0) {
            // Expand Start
            if (qStart.length > 0) {
                let curr = qStart.shift();
                visitedOrder.push(curr);
                if (visitedEnd.has(key(curr))) return { result: mergeBiPaths(curr, visitedStart, visitedEnd), visited: visitedOrder };

                for (let n of getNeighbors(grid, curr)) {
                    if (!visitedStart.has(key(n))) {
                        visitedStart.set(key(n), curr);
                        qStart.push(n);
                    }
                }
            }
            // Expand End
            if (qEnd.length > 0) {
                let curr = qEnd.shift();
                visitedOrder.push(curr);
                if (visitedStart.has(key(curr))) return { result: mergeBiPaths(curr, visitedStart, visitedEnd), visited: visitedOrder };

                for (let n of getNeighbors(grid, curr)) {
                    if (!visitedEnd.has(key(n))) {
                        visitedEnd.set(key(n), curr);
                        qEnd.push(n);
                    }
                }
            }
        }
        return { result: [], visited: visitedOrder };
    },
    swarm: (grid, start, end) => {
        // ACO-like simulation requires a different update loop. 
        // We will return a special flag or just handle it in main loop.
        // For uniformity, let's return a "visitedOrder" that is just empty 
        // and handle swarm logic in the visualization phase if algorithm == 'swarm'.
        return { result: [], visited: [], isSwarm: true };
    }
};

// Start logic
let mazeObj;

function initGame() {
    // Listeners
    document.getElementById('solve-btn').addEventListener('click', startSimulation);
    document.getElementById('reset-btn').addEventListener('click', newMaze);
    document.getElementById('algo-select').addEventListener('change', (e) => {
        algorithm = e.target.value;
        // Auto-start on selection rule
        resetForAlgo();
        startSimulation();
    });
    document.getElementById('theme-select').addEventListener('change', (e) => applyTheme(e.target.value));
    document.getElementById('speed-range').addEventListener('input', (e) => speed = Math.max(1, 51 - e.target.value));

    newMaze();
}

function resetForAlgo() {
    cancelAnimationFrame(animationId);
    isRunning = false;
    // Reset positions and state but KEEP MAZE
    tomPos = { x: 1, y: 1 };
    visitedNodes = [];
    finalPath = [];
    swarmParticles = [];
    currentSteps = 0;
    document.getElementById('steps-display').innerText = "Steps: 0";
    draw();
}

function newMaze() {
    cancelAnimationFrame(animationId);
    isRunning = false;

    // Update Canvas Size
    canvas.width = COLS * TILE_SIZE;
    canvas.height = ROWS * TILE_SIZE;

    mazeObj = new Maze(COLS, ROWS);
    grid = mazeObj.grid;
    tomPos = { x: 1, y: 1 };
    jerryPos = { x: COLS - 2, y: ROWS - 2 };

    visitedNodes = [];
    finalPath = [];
    swarmParticles = [];

    // Reset Leaderboard for new maze
    results = [];
    document.getElementById('leaderboard').style.display = 'none';

    currentSteps = 0;
    document.getElementById('steps-display').innerText = "Steps: 0";
    draw();
    document.getElementById('status').innerText = "Status: Ready";
}

// Global step counter for swarm
let currentSteps = 0;

function startSimulation() {
    if (isRunning) return;

    // Ensure clean state if manual start
    if (finalPath.length > 0) resetForAlgo();

    isRunning = true;
    currentSteps = 0;
    document.getElementById('status').innerText = `Status: Running ${algorithm}...`;

    if (algorithm === 'swarm') {
        initSwarm();
        loopSwarm();
        return;
    }

    const { result, visited, isSwarm } = Algos[algorithm](grid, tomPos, jerryPos);

    // Animate Visited
    let i = 0;
    function animateSearch() {
        if (!isRunning) return;

        // Update Steps Display
        // In search phase, steps = number of nodes visited so far
        document.getElementById('steps-display').innerText = `Steps: ${i}`;

        if (i < visited.length) {
            let steps = Math.max(1, Math.floor(50 / speed));
            for (let k = 0; k < steps && i < visited.length; k++) {
                visitedNodes.push(visited[i++]);
            }
            draw();
            animationId = requestAnimationFrame(animateSearch);
        } else {
            // Search finished
            document.getElementById('steps-display').innerText = `Steps: ${visited.length}`;

            finalPath = result;
            if (finalPath.length > 0) {
                document.getElementById('status').innerText = `Path Found in ${visited.length} steps! Moving Tom...`;
                updateLeaderboard(algorithm, visited.length);
                animateTom();
            } else {
                document.getElementById('status').innerText = "Status: No Path Found";
                isRunning = false;
            }
        }
    }
    animateSearch();
}

function animateTom() {
    let i = 0;
    function move() {
        if (!isRunning) return;

        if (i < finalPath.length) {
            tomPos = finalPath[i++];
            draw();
            setTimeout(() => requestAnimationFrame(move), speed * 5);
        } else {
            document.getElementById('status').innerText = "Status: Jerry Caught!";
            isRunning = false;
        }
    }
    move();
}

// Swarm Logic
function initSwarm() {
    swarmParticles = [];
    for (let i = 0; i < 50; i++) {
        swarmParticles.push({
            x: tomPos.x, y: tomPos.y,
            path: [],
            dead: false
        });
    }
}

function loopSwarm() {
    if (!isRunning) return;

    // Move particles
    let reached = false;
    let movesThisFrame = 0;

    for (let p of swarmParticles) {
        if (p.dead) continue;

        // Count active search steps
        movesThisFrame++;

        if (p.x === jerryPos.x && p.y === jerryPos.y) {
            reached = true;
            finalPath = p.path;
            continue;
        }

        // Simple random walk + pheromone bias (simulated by bias to interactions? no, just bias to goal)
        let neighbors = getNeighbors(grid, { x: p.x, y: p.y });
        // Filter visited in own path to avoid immediate loops
        neighbors = neighbors.filter(n => !p.path.some(step => step.x === n.x && step.y === n.y));

        if (neighbors.length === 0) {
            p.dead = true; // Stuck
        } else {
            // Pick based on heuristics (probabilistic)
            // ACO prob: P = (1/dist)^alpha
            // Here just greedy-ish random
            let best = neighbors[0];
            let bestDist = heuristic(best, jerryPos);

            // Random chance to explore
            if (Math.random() < 0.3) {
                p.path.push({ x: p.x, y: p.y });
                let next = neighbors[Math.floor(Math.random() * neighbors.length)];
                p.x = next.x; p.y = next.y;
            } else {
                neighbors.sort((a, b) => heuristic(a, jerryPos) - heuristic(b, jerryPos));
                let next = neighbors[0];
                p.path.push({ x: p.x, y: p.y });
                p.x = next.x; p.y = next.y;
            }
        }
    }

    currentSteps += movesThisFrame;
    document.getElementById('steps-display').innerText = `Steps: ${currentSteps}`;

    draw();

    if (reached) {
        document.getElementById('status').innerText = "Status: Swarm found target!";
        updateLeaderboard(algorithm, currentSteps);

        isRunning = false;
    } else {
        animationId = requestAnimationFrame(loopSwarm);
    }
}

// Helpers
function getNeighbors(grid, pos) {
    const res = [];
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (let d of dirs) {
        const nx = pos.x + d[0];
        const ny = pos.y + d[1];
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && grid[ny][nx] !== 1) {
            res.push({ x: nx, y: ny });
        }
    }
    return res;
}
function key(p) { return p ? `${p.x},${p.y}` : 'null'; }
function heuristic(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function reconstruct(cameFrom, current) {
    let path = [current];
    while (current && cameFrom.has(key(current))) {
        let parent = cameFrom.get(key(current));
        if (!parent) break;
        current = parent;
        path.push(current);
    }
    return path.reverse();
}
function mergeBiPaths(meetNode, mapStart, mapEnd) {
    // Path from start -> meet
    let p1 = reconstruct(mapStart, meetNode);
    // Path from end -> meet (reverse logic: trace parents from meet to end)
    let curr = meetNode;
    let p2 = [];
    while (mapEnd.has(key(curr))) {
        let parent = mapEnd.get(key(curr));
        if (!parent) break; // Reached the 'End' node (param end) whose parent is null
        p2.push(parent);
        curr = parent;
    }
    return p1.concat(p2);
}


// Theme Colors (Candy/Pop)
// Themes
const THEMES = {
    candy: {
        wall: '#ff7675',      // Pink/Salmon
        wallShadow: '#b2bec3',
        floor: '#dfe6e9',     // Light Grey
        grid: '#b2bec3',
        visited: 'rgba(108, 92, 231, 0.4)', // Purple
        path: '#00b894',      // Green Mint
        swarm: '#e17055',
        background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)'
    },
    cyberpunk: {
        wall: '#00d2d3',      // Cyan
        wallShadow: '#0097e6',
        floor: '#2f3542',     // Dark Grey
        grid: '#57606f',
        visited: 'rgba(255, 107, 129, 0.4)', // Neon Pink
        path: '#ffa502',      // Gold/Orange
        swarm: '#7bed9f',     // Neon Green
        background: 'linear-gradient(135deg, #130f40 0%, #30336b 100%)'
    },
    forest: {
        wall: '#27ae60',      // Green
        wallShadow: '#16a085',
        floor: '#f7f1e3',     // Beige/Sand
        grid: '#d1ccc0',
        visited: 'rgba(46, 204, 113, 0.3)', // Light Green
        path: '#e67e22',      // Carrot Orange
        swarm: '#f1c40f',     // Yellow
        background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)'
    },
    blueprint: {
        wall: '#ffffff',      // White
        wallShadow: '#74b9ff',
        floor: '#0984e3',     // Blueprint Blue
        grid: 'rgba(255,255,255,0.2)',
        visited: 'rgba(255, 255, 255, 0.3)',
        path: '#fab1a0',      // Soft Red
        swarm: '#ffeaa7',
        background: '#0984e3' // Solid Blue
    }
};

let currentTheme = THEMES['blueprint'];

function applyTheme(themeName) {
    currentTheme = THEMES[themeName];
    document.body.style.background = currentTheme.background;
    draw();
}

function draw() {
    // Fill Background (Floor)
    ctx.fillStyle = currentTheme.floor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines (optional, for texture)
    ctx.strokeStyle = currentTheme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= COLS; i++) {
        ctx.moveTo(i * TILE_SIZE, 0); ctx.lineTo(i * TILE_SIZE, canvas.height);
    }
    for (let i = 0; i <= ROWS; i++) {
        ctx.moveTo(0, i * TILE_SIZE); ctx.lineTo(canvas.width, i * TILE_SIZE);
    }
    ctx.stroke();

    // Draw Walls and Objects
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (grid[y][x] === WALL) {
                // Procedural stylized wall
                // Rounded rect effect
                let pad = 2;
                let s = TILE_SIZE - pad * 2;
                ctx.fillStyle = currentTheme.wall;

                // Shadow
                ctx.fillStyle = currentTheme.wallShadow;
                ctx.fillRect(x * TILE_SIZE + pad + 2, y * TILE_SIZE + pad + 2, s, s);

                // Main Block
                ctx.fillStyle = currentTheme.wall;
                ctx.fillRect(x * TILE_SIZE + pad, y * TILE_SIZE + pad, s, s);

                // Highlight/Bevel
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(x * TILE_SIZE + pad, y * TILE_SIZE + pad, s, s / 3);
            }
        }
    }

    // Visited
    ctx.fillStyle = currentTheme.visited;
    for (let n of visitedNodes) {
        ctx.fillRect(n.x * TILE_SIZE, n.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Path
    if (finalPath.length > 0) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentTheme.path;
        ctx.lineWidth = 8; // Thicker path
        ctx.beginPath();
        for (let i = 0; i < finalPath.length; i++) {
            let p = finalPath[i];
            if (i === 0) ctx.moveTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
            else ctx.lineTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
        }
        ctx.stroke();
    }

    // Swarm
    if (algorithm === 'swarm') {
        ctx.fillStyle = currentTheme.swarm;
        for (let p of swarmParticles) {
            if (!p.dead) {
                ctx.beginPath();
                ctx.arc(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Agents
    // Draw Jerry (Goal) - Glow
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0984e3';
    ctx.drawImage(jerryImg, jerryPos.x * TILE_SIZE, jerryPos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.restore();

    // Draw Tom (Agent)
    ctx.drawImage(tomImg, tomPos.x * TILE_SIZE, tomPos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

