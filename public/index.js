// Image loading
const mapImage = new Image();
mapImage.src = '/snow.png';

const characterImage = new Image();
characterImage.src = '/character.png';

const nutshotAlienImage = new Image();
nutshotAlienImage.src = '/nutshot_alien.png';

const targetImage = new Image();
targetImage.src = '/target.png';

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
const totalImages = 4;

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
characterImage.onload = onImageLoad;
nutshotAlienImage.onload = onImageLoad;
targetImage.onload = onImageLoad;

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

function check_username() {
  const modal = document.getElementById('username-modal');
  const input = document.getElementById('username-input');
  const submitButton = document.getElementById('username-submit');

  // Show the modal
  modal.classList.remove('hidden');

  // Focus on input after a short delay to ensure modal is visible
  setTimeout(() => input.focus(), 100);

  // Handle submit button click
  const handleSubmit = () => {
    const nickname = input.value.trim();
    if (nickname) {
      socket.emit('send-nickname', nickname);
      modal.classList.add('hidden');
      // Remove event listeners
      submitButton.removeEventListener('click', handleSubmit);
      input.removeEventListener('keypress', handleKeyPress);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  submitButton.addEventListener('click', handleSubmit);
  input.addEventListener('keypress', handleKeyPress);
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
  // Calculate angle from snowball spawn position (character center-bottom) to mouse cursor
  // Character is always centered on screen, snowball spawns at character center-bottom
  const snowballSpawnX = canvasHalfWidth + 7.5;  // Center of character
  const snowballSpawnY = canvasHalfHeight + 58.5; // Near bottom of character

  const angle = Math.atan2(
    e.clientY - snowballSpawnY,
    e.clientX - snowballSpawnX,
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
      const playerScreenX = player.x - cameraX;
      const playerScreenY = player.y - cameraY;

      // Select the correct character image based on player's character type
      let playerImage = characterImage; // default
      if (player.character === "nutshot_alien") {
        playerImage = nutshotAlienImage;
      } else if (player.character === "target") {
        playerImage = targetImage;
      }

      // Save canvas state before transformations
      canvas.save();

      // Flip character horizontally if facing left
      if (player.direction === "left") {
        canvas.translate(playerScreenX + 40, playerScreenY); // Translate to player center
        canvas.scale(-1, 1); // Flip horizontally
        canvas.drawImage(playerImage, -25, 0, 65, 65);
      } else {
        // Facing right (default)
        canvas.drawImage(playerImage, playerScreenX - 25, playerScreenY, 65, 65);
      }

      // Restore canvas state
      canvas.restore();

      // Draw username centered above character
      let displayName;
      if (player.username.toString() == "❄️null") {
        displayName = player.id.slice(0, 10) + "...";
      } else {
        displayName = player.username.length > 10 ? `${player.username.slice(0, 10)}...` : player.username;
      }

      // Measure text width to center it
      const textWidth = canvas.measureText(displayName).width;
      const characterCenterX = playerScreenX + 7.5; // Center of 65px character at playerScreenX - 25
      const textX = characterCenterX - (textWidth / 2);

      canvas.fillText(displayName, textX, playerScreenY - 10);
    }

    // Render snowballs (optimized)
    canvas.fillStyle = "#FFFFFF";
    for (const snowball of snowballs) {
      canvas.beginPath();
      canvas.arc(snowball.x - cameraX, snowball.y - cameraY, SNOWBALL_RADIUS, 0, 2 * Math.PI);
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
