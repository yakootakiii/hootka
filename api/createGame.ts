import { authenticateHost, body, requireString, route } from './_lib/http.js';
import { createGame } from './_lib/game.js';

export default route(async (request) => {
  const caller = await authenticateHost(request);
  const data = body(request);
  return createGame(
    caller,
    requireString(data.quizId, 'quizId'),
    (data.settings as { streakBonus?: boolean } | undefined)?.streakBonus === true,
  );
});
