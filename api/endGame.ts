import { authenticateHost, body, requireString, route } from './_lib/http.js';
import { endGame } from './_lib/game.js';

export default route(async (request) => {
  const caller = await authenticateHost(request);
  return endGame(caller, requireString(body(request).gameId, 'gameId'));
});
