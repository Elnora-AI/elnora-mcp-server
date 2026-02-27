import { Request, Response } from "express";
import { ElnoraConfig } from "../types.js";

export function protectedResourceMetadataHandler(config: ElnoraConfig) {
  return (req: Request, res: Response): void => {
    const resource = process.env.RESOURCE_URL || `${req.protocol}://${req.get("host")}`;
    res.json({
      resource,
      authorization_servers: [config.authUrl],
      scopes_supported: [
        "tasks:read",
        "tasks:write",
        "files:read",
        "files:write",
        "messages:read",
        "messages:write",
      ],
      bearer_methods_supported: ["header"],
    });
  };
}
