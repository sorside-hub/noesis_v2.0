import { handleClassify } from '../../src/api-handlers/classify';

export const onRequestPost = async (context: { request: Request; env: any }) => {
  return handleClassify(context.request, context.env);
};
