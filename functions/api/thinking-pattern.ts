import { handleThinkingPattern } from '../../src/api-handlers/thinkingPattern';

export const onRequestPost = async (context: { request: Request; env: any }) => {
  return handleThinkingPattern(context.request, context.env);
};
