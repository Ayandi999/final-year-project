import { Router } from "express";
import { handleRoomCreation } from "./socket.service";

const socketRouter = Router();

socketRouter.get('/roomid', handleRoomCreation)

export default socketRouter;