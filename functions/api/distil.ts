import { handleDistil } from '../../src/api-handlers/distil';

export const onRequestPost = async (context: { request: Request; env: any }) => {
  return handleDistil(context.request, context.env);
};
