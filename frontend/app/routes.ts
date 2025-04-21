import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("workspaces", "routes/workspaces.tsx"),
  route("workspaces/:workspaceId", "routes/workspace-layout.tsx", [
    route("chat/:chatId", "routes/chat.tsx"),
    route("chat/new", "routes/new-chat.tsx"),
  ]),
] satisfies RouteConfig;
