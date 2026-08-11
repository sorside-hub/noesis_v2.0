import { handleAutoCorrect } from '../../src/api-handlers/autoCorrect';

export const onRequestPost = async (context: { request: Request; env: any }) => {
  return handleAutoCorrect(context.request, context.env);
};
