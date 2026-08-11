import { handleAutoDetect } from '../../src/api-handlers/autoDetect';

export const onRequestPost = async (context: { request: Request; env: any }) => {
  return handleAutoDetect(context.request, context.env);
};
