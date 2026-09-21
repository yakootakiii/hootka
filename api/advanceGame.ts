import { authenticateHost, body, requireString, route } from './_lib/http.js';
import { advanceGame } from './_lib/game.js';

export default route(async (request) => {
  const caller = await authenticateHost(request);
  const data = body(request);
  return advanceGame(
    caller,
    requireString(data.gameId, 'gameId'),
    data.skip === true,
    typeof data.expectPhase === 'string' ? data.expectPhase : undefined,
  );
});
