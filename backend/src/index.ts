import 'dotenv/config'
import { app } from "./app";
import http from 'node:http'
import { initSocket } from "./socket/socket.service";

const server = http.createServer(app);

const PORT = process.env.PORT || 8083;

async function startServer() {
    try {
        initSocket(server);

        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    } catch (error) {
        console.error("Failed to start server:", error);
    }
}
startServer()