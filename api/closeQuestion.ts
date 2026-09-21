import { authenticateHost, body, requireIndex, requireString, route } from './_lib/http.js';
import { closeQuestion } from './_lib/game.js';

export default route(async (request) => {
  const caller = await authenticateHost(request);
  const data = body(request);
  return closeQuestion(
    caller,
    requireString(data.gameId, 'gameId'),
    requireIndex(data.questionIndex, 'questionIndex'),
  );
});
