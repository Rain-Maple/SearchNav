export default async () => {
  return new Response("test ok", { status:200 });
};
export const config = {
  path: "/api/favicon"
};
