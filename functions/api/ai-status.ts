import { handleAiStatus } from '../../src/api-handlers/aiStatus';

export const onRequest = async (context: { request: Request; env: any }) => {
  return handleAiStatus(context.request, context.env);
};
