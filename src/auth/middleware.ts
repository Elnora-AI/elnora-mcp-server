import { Request, Response, NextFunction } from "express";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { AuthContext, ElnoraConfig } from "../types.js";

// Extend Express Request to include auth context
declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
      bearerToken?: string;
    }
  }
}

export function authMiddleware(config: ElnoraConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.setHeader(
        "WWW-Authenticate",
        `Bearer resource_metadata="${req.protocol}://${req.get("host")}/.well-known/oauth-protected-resource"`,
      );
      res.status(401).json({
        error: "unauthorized",
        error_description: "Bearer token required",
      });
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer "

    try {
      const validation = await ElnoraApiClient.validateToken(config.tokenValidationUrl, token);

      if (!validation.valid || !validation.userId || !validation.organizationId) {
        res.status(401).json({
          error: "invalid_token",
          error_description: "Token is invalid or expired",
        });
        return;
      }

      req.authContext = {
        userId: validation.userId,
        organizationId: validation.organizationId,
        scopes: validation.scopes || "",
        tokenType: validation.tokenType || "unknown",
      };
      req.bearerToken = token;
      next();
    } catch {
      res.status(401).json({
        error: "invalid_token",
        error_description: "Token validation failed",
      });
    }
  };
}
