import { handleChat } from '../../src/api-handlers/chat';

export const onRequestPost = async (context: { request: Request; env: any }) => {
  return handleChat(context.request, context.env);
};
