import { authenticateHost, body, requireString, route } from './_lib/http.js';
import { kickPlayer } from './_lib/game.js';

export default route(async (request) => {
  const caller = await authenticateHost(request);
  const data = body(request);
  return kickPlayer(caller, requireString(data.gameId, 'gameId'), requireString(data.playerUid, 'playerUid'));
});
