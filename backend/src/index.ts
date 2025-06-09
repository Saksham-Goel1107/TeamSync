import "dotenv/config";
import express, { Request } from "express";
import cors from "cors";
import session from "cookie-session";
import { config } from "./config/app.config";
import connectDatabase from "./config/database.config";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { asyncHandler } from "./middlewares/asyncHandler.middleware";
import { BadRequestException } from "./utils/appError";
import { ErrorCodeEnum } from "./enums/error-code.enum";

import "./config/passport.config";
import passport from "passport";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import isAuthenticated from "./middlewares/isAuthenticated.middleware";
import workspaceRoutes from "./routes/workspace.route";
import memberRoutes from "./routes/member.route";
import projectRoutes from "./routes/project.route";
import taskRoutes from "./routes/task.route";
import chatRoutes from "./routes/chat.route";
import { createServer } from "http";
import { initializeSocketIO } from "./services/socket.service";

const app = express();
const BASE_PATH = config.BASE_PATH;

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["set-cookie"]
  })
);

app.use(
  session({
    name: "session",
    keys: [config.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: false, // Set to true in production
    sameSite: "lax",
    httpOnly: true
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get(
  `/`,
  asyncHandler(async (_: Request) => {
    throw new BadRequestException(
      "This is a bad request",
      ErrorCodeEnum.AUTH_INVALID_TOKEN
    );
  })
);

app.get('/health', (_, res) => {
  res.send('Server is running...')
})

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, isAuthenticated, userRoutes);
app.use(`${BASE_PATH}/workspace`, isAuthenticated, workspaceRoutes);
app.use(`${BASE_PATH}/member`, isAuthenticated, memberRoutes);
app.use(`${BASE_PATH}/project`, isAuthenticated, projectRoutes);
app.use(`${BASE_PATH}/task`, isAuthenticated, taskRoutes);
app.use(`${BASE_PATH}`, isAuthenticated, chatRoutes);

app.use(errorHandler);

// Create HTTP server instance
const httpServer = createServer(app);

// Initialize Socket.IO with the HTTP server
initializeSocketIO(httpServer);

httpServer.listen(config.PORT, async () => {
  console.log(`Server listening on port ${config.PORT} in ${config.NODE_ENV}`);
  console.log(`Socket.IO server initialized`);
  await connectDatabase();
});
