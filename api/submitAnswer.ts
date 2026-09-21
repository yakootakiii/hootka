import { authenticate, body, requireIndex, requireString, route } from './_lib/http.js';
import { submitAnswer } from './_lib/game.js';

export default route(async (request) => {
  const caller = await authenticate(request);
  const data = body(request);
  return submitAnswer(
    caller,
    requireString(data.gameId, 'gameId'),
    requireIndex(data.questionIndex, 'questionIndex'),
    requireIndex(data.choice, 'choice'),
  );
});
