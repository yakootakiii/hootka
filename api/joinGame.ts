import { authenticate, body, requireString, route } from './_lib/http.js';
import { joinGame } from './_lib/game.js';

export default route(async (request) => {
  const caller = await authenticate(request);
  const data = body(request);
  return joinGame(caller, requireString(data.code, 'code', 20), requireString(data.name, 'name', 64));
});
