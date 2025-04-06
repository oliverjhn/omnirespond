import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  route("workspaces/:workspaceId", "routes/workspaceLayout.tsx", [
    route("chat/:chatId", "routes/chat.tsx"),
  ]),
] satisfies RouteConfig;
