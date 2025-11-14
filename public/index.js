// Image loading
const mapImage = new Image();
mapImage.src = '/snow.png';

const snowmanImage = new Image();
snowmanImage.src = '/snowman.png';

const santaHat = new Image();
santaHat.src = '/santa-hat.png';

// Canvas setup with proper DPI handling
const canvasElement = document.getElementById('canvas');
const dpr = window.devicePixelRatio || 1;
const displayWidth = window.innerWidth;
const displayHeight = window.innerHeight;

canvasElement.width = displayWidth * dpr;
canvasElement.height = displayHeight * dpr;
canvasElement.style.width = displayWidth + 'px';
canvasElement.style.height = displayHeight + 'px';

const canvas = canvasElement.getContext('2d');
canvas.scale(dpr, dpr);

const socket = io();

let groundMap = [[]];
let treeMap = [[]];
let otherTreeMap = [[]];

let joinedMap = [];
let players = [];
let snowballs = [];
const SNOWBALL_RADIUS = 2.5;

const TILE_SIZE = 16;
const TILES_IN_ROW = 16;

// Offscreen canvases for map caching
let groundCanvas = null;
let treeCanvas = null;
let otherTreeCanvas = null;
let mapsPreRendered = false;

// Image loading state
let imagesLoaded = 0;
const totalImages = 3;

// Cached myPlayer
let cachedMyPlayer = null;

// Cached DOM elements
const joinedUsersElement = document.getElementById('joined-users');
const snowballsNumberElement = document.getElementById('snowballsNumber');

// Cached canvas dimensions for click handler
let canvasHalfWidth = displayWidth / 2;
let canvasHalfHeight = displayHeight / 2;

// Animation frame ID for cleanup
let animationFrameId = null;

// Previous input state for change detection
let previousInputs = {
  up: false,
  down: false,
  left: false,
  right: false,
};

// Image preloading with onload handlers
function onImageLoad() {
  imagesLoaded++;
  if (imagesLoaded === totalImages) {
    // All images loaded, pre-render maps if map data is available
    if (groundMap.length > 1 && groundMap[0].length > 0) {
      preRenderMaps();
    }
  }
}

mapImage.onload = onImageLoad;
snowmanImage.onload = onImageLoad;
santaHat.onload = onImageLoad;

// Pre-render static map layers to offscreen canvases
function preRenderMaps() {
  // Safety checks: Ensure all map arrays are valid
  if (!groundMap || !groundMap[0] || groundMap[0].length === 0) return;
  if (!treeMap || !treeMap[0] || treeMap[0].length === 0) return;
  if (!otherTreeMap || !otherTreeMap[0] || otherTreeMap[0].length === 0) return;

  try {
    const mapWidth = groundMap[0].length * TILE_SIZE;
    const mapHeight = groundMap.length * TILE_SIZE;

  // Ground layer
  groundCanvas = document.createElement('canvas');
  groundCanvas.width = mapWidth;
  groundCanvas.height = mapHeight;
  const groundCtx = groundCanvas.getContext('2d');

  for (let row = 0; row < groundMap.length; row++) {
    for (let col = 0; col < groundMap[0].length; col++) {
      const { id } = groundMap[row][col] ?? { id: undefined };
      if (id !== undefined) {
        const imageRow = (id / TILES_IN_ROW) | 0;
        const imageCol = id % TILES_IN_ROW;
        groundCtx.drawImage(
          mapImage,
          imageCol * TILE_SIZE,
          imageRow * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          col * TILE_SIZE,
          row * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE
        );
      }
    }
  }

  // Tree layer
  treeCanvas = document.createElement('canvas');
  treeCanvas.width = mapWidth;
  treeCanvas.height = mapHeight;
  const treeCtx = treeCanvas.getContext('2d');

  for (let row = 0; row < treeMap.length; row++) {
    for (let col = 0; col < treeMap[0].length; col++) {
      const { id } = treeMap[row][col] ?? { id: undefined };
      if (id !== undefined) {
        const imageRow = (id / TILES_IN_ROW) | 0;
        const imageCol = id % TILES_IN_ROW;
        treeCtx.drawImage(
          mapImage,
          imageCol * TILE_SIZE,
          imageRow * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          col * TILE_SIZE,
          row * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE
        );
      }
    }
  }

  // Other tree layer
  otherTreeCanvas = document.createElement('canvas');
  otherTreeCanvas.width = mapWidth;
  otherTreeCanvas.height = mapHeight;
  const otherTreeCtx = otherTreeCanvas.getContext('2d');

  for (let row = 0; row < otherTreeMap.length; row++) {
    for (let col = 0; col < otherTreeMap[0].length; col++) {
      const { id } = otherTreeMap[row][col] ?? { id: undefined };
      if (id !== undefined) {
        const imageRow = (id / TILES_IN_ROW) | 0;
        const imageCol = id % TILES_IN_ROW;
        otherTreeCtx.drawImage(
          mapImage,
          imageCol * TILE_SIZE,
          imageRow * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          col * TILE_SIZE,
          row * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE
        );
      }
    }
  }

    mapsPreRendered = true;
  } catch (error) {
    console.error('Error pre-rendering maps:', error);
    // Reset flag to prevent trying to draw invalid canvases
    mapsPreRendered = false;
    groundCanvas = null;
    treeCanvas = null;
    otherTreeCanvas = null;
  }
}

socket.on('connect', function(socket) {
  // console.log(socket);
  check_username();
});

async function check_username() {
  const nickname = await prompt('Enter a username!');
  socket.emit('send-nickname', nickname);
}

socket.on('map', (loadedMap) => {
  groundMap = loadedMap.ground;
  treeMap = loadedMap.trees;
  otherTreeMap = loadedMap.trees2;

  // Pre-render maps if images are already loaded
  if (imagesLoaded === totalImages) {
    preRenderMaps();
  }
});

socket.on('players', (serverPlayers) => {
  players = serverPlayers;
  // Update cached myPlayer when players array changes
  cachedMyPlayer = players.find((player) => player.id === socket.id) || null;
});

socket.on('snowballs', (serverSnowballs) => {
  snowballs = serverSnowballs;
});

socket.on('user-joined', (serverPlayerLength) => {
  const playerLength = serverPlayerLength;
  updateUsers(playerLength);
});

function updateUsers(x) {
  joinedUsersElement.textContent = x;
}

socket.on("players-melted", (serverPlayersMelted) => {
  if (serverPlayersMelted.length > 0) {
    snowballsNumberElement.textContent = serverPlayersMelted.length + " player(s) melted!";
  }
});

let touchY = '';
let touchX = '';
let touchThreshold = 30;

const inputs = {
  up: false,
  down: false,
  left: false,
  right: false,
};

// Helper function to check if inputs changed
function inputsChanged() {
  return inputs.up !== previousInputs.up ||
         inputs.down !== previousInputs.down ||
         inputs.left !== previousInputs.left ||
         inputs.right !== previousInputs.right;
}

// Helper function to update previous inputs
function updatePreviousInputs() {
  previousInputs.up = inputs.up;
  previousInputs.down = inputs.down;
  previousInputs.left = inputs.left;
  previousInputs.right = inputs.right;
}

const handleKeyDown = (e) => {
  let changed = false;

  if (e.key === "w" && !inputs["up"]) {
    inputs["up"] = true;
    changed = true;
  } else if (e.key === "s" && !inputs["down"]) {
    inputs["down"] = true;
    changed = true;
  } else if (e.key === "d" && !inputs["right"]) {
    inputs["right"] = true;
    changed = true;
  } else if (e.key === "a" && !inputs["left"]) {
    inputs["left"] = true;
    changed = true;
  }

  if (changed) {
    socket.emit('inputs', inputs);
    updatePreviousInputs();
  }
};

const handleKeyUp = (e) => {
  let changed = false;

  if (e.key === "w" && inputs["up"]) {
    inputs["up"] = false;
    changed = true;
  } else if (e.key === "s" && inputs["down"]) {
    inputs["down"] = false;
    changed = true;
  } else if (e.key === "d" && inputs["right"]) {
    inputs["right"] = false;
    changed = true;
  } else if (e.key === "a" && inputs["left"]) {
    inputs["left"] = false;
    changed = true;
  }

  if (changed) {
    socket.emit('inputs', inputs);
    updatePreviousInputs();
  }
};

const handleCanvasClick = (e) => {
  const angle = Math.atan2(
    e.clientY - canvasHalfHeight,
    e.clientX - canvasHalfWidth,
  );
  socket.emit('snowballs', angle);
};

const handleResize = () => {
  const newDisplayWidth = window.innerWidth;
  const newDisplayHeight = window.innerHeight;

  canvasElement.width = newDisplayWidth * dpr;
  canvasElement.height = newDisplayHeight * dpr;
  canvasElement.style.width = newDisplayWidth + 'px';
  canvasElement.style.height = newDisplayHeight + 'px';

  canvas.scale(dpr, dpr);

  canvasHalfWidth = newDisplayWidth / 2;
  canvasHalfHeight = newDisplayHeight / 2;
};

const handleBeforeUnload = () => {
  cleanup();
};

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
canvasElement.addEventListener('click', handleCanvasClick);
window.addEventListener('resize', handleResize);
window.addEventListener('beforeunload', handleBeforeUnload);

function loop() {
  try {
    // Only render if images are loaded
    if (imagesLoaded < totalImages) {
      animationFrameId = window.requestAnimationFrame(loop);
      return;
    }

    canvas.clearRect(0, 0, displayWidth, displayHeight);

    let cameraX = 0;
    let cameraY = 0;
    if (cachedMyPlayer) {
      cameraX = (cachedMyPlayer.x - displayWidth / 2) | 0;
      cameraY = (cachedMyPlayer.y - displayHeight / 2) | 0;
    }

    // Render pre-rendered map layers (3 draw calls instead of 120,000+)
    if (mapsPreRendered && groundCanvas && treeCanvas && otherTreeCanvas) {
      canvas.drawImage(groundCanvas, -cameraX, -cameraY);
      canvas.drawImage(treeCanvas, -cameraX, -cameraY);
      canvas.drawImage(otherTreeCanvas, -cameraX, -cameraY);
    }

    // Render players
    for (const player of players) {
      canvas.drawImage(snowmanImage, player.x - cameraX - 25, player.y - cameraY, 65, 65);
      canvas.drawImage(santaHat, player.x - cameraX + 1, player.y - cameraY, 18, 18);
      if (player.username.toString() == "❄️null") {
        canvas.fillText(player.id.slice(0, 10) + "...", player.x - cameraX - 25, player.y - cameraY - 10);
      } else {
        canvas.fillText(player.username.slice(0, 10) ? `${player.username}` : `${player.username.slice(0, 10)}...`, player.x - cameraX - 25, player.y - cameraY - 10);
      }
    }

    // Render snowballs (optimized)
    canvas.fillStyle = "#FFFFFF";
    for (const snowball of snowballs) {
      canvas.beginPath();
      canvas.arc(snowball.x - cameraX - 15, snowball.y - cameraY + 25, SNOWBALL_RADIUS, 0, 2 * Math.PI);
      canvas.fill();
    }
  } catch (error) {
    console.error('Error in render loop:', error);
  }

  animationFrameId = window.requestAnimationFrame(loop);
}

// Cleanup function
function cleanup() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
  }
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  canvasElement.removeEventListener('click', handleCanvasClick);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('beforeunload', handleBeforeUnload);
}

socket.on('disconnect', () => {
  cleanup();
});

// Start the render loop
animationFrameId = window.requestAnimationFrame(loop);
