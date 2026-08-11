import { handleEmbed } from '../../src/api-handlers/embed';

export const onRequestPost = async (context: { request: Request; env: any }) => {
  return handleEmbed(context.request, context.env);
};
