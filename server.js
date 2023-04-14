const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');

let player;
let world = new World();
world.loadWorld(worldData);

function playerCheck(res) {
  if (!player) {
    res.statusCode = 302;
    res.setHeader('Location', `/`);
    res.end();
    return true;
  }
}

const server = http.createServer((req, res) => {

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if (req.method === 'GET' && req.url === "/") {
      const htmlPage = fs.readFileSync('./views/new-player.html', 'utf-8');
      const resBody = htmlPage
        .replace(/#{availableRooms}/g, world.availableRoomsToString());

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.write(resBody);
      return res.end();
    }

    // Phase 2: POST /player
    if (req.method === 'POST' && req.url === "/player") {
      let playerName = req.body.name;
      let room = world.rooms[req.body.roomId];

      player = new Player(playerName, room);


      res.statusCode = 302;
      res.setHeader('Location', `/rooms/${req.body.roomId}`);
      return res.end()
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === 'GET' && req.url.startsWith("/rooms/")) {

      if (playerCheck(res)) return;

      const splitUrl = req.url.split('/');


      if (splitUrl.length === 3) {
        const roomId = splitUrl[2];
        const currentRoom = player.currentRoom.id;

        if (roomId !== String(currentRoom)) {
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${currentRoom}`);
          return res.end();
        }

        const room = world.rooms[roomId];
        const roomName = room.name;
        const roomItems = room.itemsToString();
        const inventory = player.inventoryToString();
        const exits = room.exitsToString();

        const htmlPage = fs.readFileSync('./views/room.html', 'utf-8');
        const resBody = htmlPage
          .replace(/#{roomName}/g, roomName)
          .replace(/#{roomId}/g, roomId)
          .replace(/#{roomItems}/g, roomItems)
          .replace(/#{inventory}/g, inventory)
          .replace(/#{exits}/g, exits);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.write(resBody);
        return res.end();
      }
    }

    // Phase 4: GET /rooms/:roomId/:direction
    if (req.method === 'GET' && req.url.startsWith("/rooms/")) {

      if (playerCheck(res)) return;

      const splitUrl = req.url.split('/');

      if (splitUrl.length === 4) {
        const roomId = splitUrl[2];
        const direction = splitUrl[3];
        const currentRoom = player.currentRoom.id;

        if (roomId !== String(currentRoom)) {
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${currentRoom}`);
          return res.end();
        }

        nextRoom = player.move(direction[0]);

        try {
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${nextRoom.id}`);
          return res.end();
        } catch {
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${currentRoom}`);
          return res.end();
        }

      }
    }

    // Phase 5: POST /items/:itemId/:action
    if (req.method === 'POST' && req.url.startsWith("/items/")) {

      if (playerCheck(res)) return;

      const splitUrl = req.url.split('/');
      const currentRoom = player.currentRoom.id;

      if (splitUrl.length === 4) {
        const itemId = splitUrl[2];
        const action = splitUrl[3];

        try {
          switch (action) {
            case 'drop':
                player.dropItem(itemId);
                break;
            case 'eat':
                player.eatItem(itemId);
                break;
            case 'take':
                player.takeItem(itemId);
                break;
            default:
                break;
          }

          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${currentRoom}`);
          return res.end();

        } catch(err) {
          const htmlPage = fs.readFileSync('./views/error.html', 'utf-8');
          const resBody = htmlPage
            .replace(/#{errorMessage}/g, err)
            .replace(/#{roomId}/g, currentRoom);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          res.write(resBody);
          return res.end();
        }
      }
    }

    // Phase 6: Redirect if no matching route handlers
    if (playerCheck(res)) return;

    res.statusCode = 302;
    res.setHeader('Location', `/rooms/${currentRoom}`);
    return res.end();
  })
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));
