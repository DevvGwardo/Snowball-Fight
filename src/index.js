const express = require('express');
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

const loadMap = require("./mapLoader");

const SPEED = 2.5;
const TICK_RATE = 64;
const SNOWBALL_SPEED = 3;
const PLAYER_SIZE = 65;
const TILE_SIZE = 16;

let players = [];
let snowballs = [];

let playersMelted = [];

const inputsMap = {};
let ground2D, logos2D, trees2D;

function isColliding(rect1, rect2) {
  return ( 
    rect1.x < rect2.x + rect2.w &&
    rect1.x + rect1.w > rect2.x &&
    rect1.y < rect2.y + rect2.h &&
    rect1.h + rect1.y > rect2.y 
  );
}

function isCollidingWithMap(player) {
  // Optimized: Only check tiles near the player instead of entire map
  const minCol = Math.max(0, Math.floor(player.x / TILE_SIZE));
  const maxCol = Math.min(logos2D[0].length - 1, Math.ceil((player.x + 16) / TILE_SIZE));
  const minRow = Math.max(0, Math.floor(player.y / TILE_SIZE));
  const maxRow = Math.min(logos2D.length - 1, Math.ceil((player.y + 16) / TILE_SIZE));

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const tile = logos2D[row][col];
      if(tile && isColliding(
        {
          w: 16,
          h: 16,
          x: player.x,
          y: player.y,
        },
        {
          x: col * TILE_SIZE,
          y: row * TILE_SIZE,
          w: TILE_SIZE,
          h: TILE_SIZE
        }
      )) {
        return true;
      }
    }
  }
  return false;
}

function tick(delta) {
  // Process player movement first
  for (const player of players) {
    const inputs = inputsMap[player.id];

    // Safety check: Skip this player if inputs don't exist yet
    if (!inputs) {
      continue;
    }

    const previousY = player.y;
    const previousX = player.x;

    // Invert controls for "target" character
    const isTarget = player.character === "target";

    if(inputs.up === true) {
      player.y += isTarget ? SPEED : -SPEED;
    } else if (inputs.down === true) {
      player.y += isTarget ? -SPEED : SPEED;
    };

    if(isCollidingWithMap(player)) {
      player.y = previousY;
    }

    if(inputs.left === true) {
      player.x += isTarget ? SPEED : -SPEED;
      player.direction = "left"; // Face based on key pressed
    } else if (inputs.right === true) {
      player.x += isTarget ? -SPEED : SPEED;
      player.direction = "right"; // Face based on key pressed
    };

    if(isCollidingWithMap(player)) {
      player.x = previousX;
    }
  }

  // Process snowball movement and collisions separately (outside player loop)
  for(const snowball of snowballs) {
    snowball.x += Math.cos(snowball.angle) * SNOWBALL_SPEED;
    snowball.y += Math.sin(snowball.angle) * SNOWBALL_SPEED;
    snowball.timeLeft -= delta;

    for(const player of players) {
      if(player.id === snowball.playerId) continue;

      // Fixed distance calculation with squared distance optimization
      const dx = (player.x + PLAYER_SIZE) - snowball.x;
      const dy = (player.y - 65 + PLAYER_SIZE) - snowball.y;
      const distanceSquared = dx * dx + dy * dy;

      if(distanceSquared <= PLAYER_SIZE * PLAYER_SIZE) {
        if(snowball.x < 300) {
          break;
        } else if(snowball.y < 300) {
          break;
        } else {
          player.x = 250;
          player.y = 250;
          snowball.timeLeft = 0;
          playersMelted.push(player.id)
          break;
        }
      }
    }
  }

  snowballs = snowballs.filter((snowball) => snowball.timeLeft > 0);

  // Move io.emit calls outside player loop - emit once per tick instead of once per player
  io.emit("players", players);
  io.emit("snowballs", snowballs);
  io.emit("user-joined", players.length);
  io.emit("players-melted", playersMelted);

  // Clear playersMelted after emitting
  playersMelted = [];
}

async function main() {
  ({ ground2D, trees2D, logos2D } = await loadMap());

  io.on('connect', (socket) => {
    console.log("User connected to ", socket.id);

    inputsMap[socket.id] = {
      up: false,
      down: false,
      left: false,
      right: false
    };

    socket.on('send-nickname', function(nickname) {
      socket.nickname = nickname;
      // users.push(socket.nickname);
      // console.log(nickname);

      // Randomly choose between three character types
      const characterTypes = ["character", "nutshot_alien", "target"];
      const randomCharacter = characterTypes[Math.floor(Math.random() * characterTypes.length)];

      players.push({
        id: socket.id,
        x: 1000,
        y: 1000,
        username: "❄️" + nickname,
        direction: "right", // Default facing direction
        character: randomCharacter // Randomly assigned character type
      });
    });

    socket.emit("map", {
      ground: ground2D,
      trees: trees2D,
      trees2: logos2D,
    });

    socket.on('inputs', (inputs) => {
      inputsMap[socket.id] = inputs;
    });

    socket.on('snowballs', (angle) => {
      const player = players.find((player) => player.id === socket.id);

      // Safety check: Only create snowball if player exists
      if (!player) {
        return;
      }

      // Prevent "target" characters from shooting snowballs
      if (player.character === "target") {
        return;
      }

      snowballs.push({
        angle,
        x: player.x + 7.5,  // Center of character (player.x - 25 + 32.5)
        y: player.y + 58.5, // 10% from bottom of character (65px height - 6.5px)
        timeLeft: 1000,
        playerId: socket.id,
      });
    });

    socket.on('disconnect', () => {
      players = players.filter((player) => player.id !== socket.id);
      // Fix memory leak: delete inputsMap entry on disconnect
      delete inputsMap[socket.id];
    });
    
  });
  
  app.use(express.static("public"));
  
  httpServer.listen(PORT);

  let lastUpdate = Date.now();
  setInterval(() => {
    const now = Date.now();
    const delta = now - lastUpdate;
    tick(delta);
    lastUpdate = now;
  }, 1000 / TICK_RATE);
}
main()