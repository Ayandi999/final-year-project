import { Server } from 'socket.io';
import type { Request, Response } from "express";
import { createRoom, joinRoom, leaveRoom } from "../service/valkey.service";

export async function handleRoomCreation(req: Request, res: Response) {
  try {
    const hostId = (req.query.hostId as string) || (req.body?.hostId as string);
    if (!hostId) {
      res.status(400).json({ error: "hostId parameter is required (via query or body)" });
      return;
    }

    // Generate a unique room ID and store it in Valkey
    const roomId = await createRoom(hostId);

    res.status(200).json({
      success: true,
      roomId,
      hostId
    });
  } catch (error: any) {
    console.error("Error creating room:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating room",
      error: error.message
    });
  }
}

export function initSocket(server: any) {
  const io = new Server(server, {
    cors: {
        origin: '*',
        // credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[CONNECTED] New device linked via WebSocket: ${socket.id}`); 

    socket.on('join-room', async (roomId: any, chosenRole: any, callback: any) => {
        let finalRole = chosenRole;
        let cb = callback;
        try {
            
            // Handle client sending 2 arguments: roomId, callback (backward-compatibility)
            if (typeof chosenRole === 'function') {
                cb = chosenRole;
                finalRole = undefined;
            }

            const result = await joinRoom(roomId, socket.id, finalRole);
            if (!result.success) {
                if (typeof cb === 'function') {
                    cb({ success: false, message: result.message || 'Room not found, full, or role taken' });
                } else {
                    socket.emit('error', { message: result.message || 'Room not found, full, or role taken' });
                }
                return;
            }

            socket.join(roomId);
            console.log(`[ROOM JOINED] ${socket.id} has joined room ${roomId} as ${result.role}`);
            
            // Notify other participants in the room
            socket.to(roomId).emit('user-joined', { userId: socket.id, role: result.role });

            if (typeof cb === 'function') {
                cb({ success: true, roomId, role: result.role });
            }
        } catch (error: any) {
            console.error('Error joining room:', error);
            if (typeof cb === 'function') {
                cb({ success: false, error: error.message });
            }
        }
    });

    // Translation Data Relay (Signer -> Listener)
    socket.on('translation-data', ({ text, room }) => {
        console.log(`[TRANSLATION] Relaying sign translation: "${text}" from ${socket.id} to room ${room}`);
        socket.to(room).emit('translation-data', { text, signerId: socket.id });
    });

    // WebRTC Signaling Handlers (Relays offer, answer, and ICE candidates between clients)
    socket.on('webrtc-offer', ({ offer, room }) => {
        console.log(`[SIGNAL] Forwarding WebRTC Offer from ${socket.id} to room ${room}`);
        socket.to(room).emit('webrtc-offer', offer);
    });

    socket.on('webrtc-answer', ({ answer, room }) => {
        console.log(`[SIGNAL] Forwarding WebRTC Answer from ${socket.id} to room ${room}`);
        socket.to(room).emit('webrtc-answer', answer);
    });

    socket.on('ice-candidate', ({ candidate, room }) => {
        console.log(`[SIGNAL] Relaying ICE Candidate from ${socket.id} to room ${room}`);
        socket.to(room).emit('ice-candidate', candidate);
    });

    // Disconnect cleanup
    socket.on('disconnect', async () => {
        console.log(`[DISCONNECTED] Device unlinked: ${socket.id}`);
        try {
            const result = await leaveRoom(socket.id);
            if (result && result.roomId) {
                // Notify remaining peers in the room
                socket.to(result.roomId).emit('peer-left', 'The other user disconnected.');
                console.log(`[ROOM EXIT] User ${socket.id} left room ${result.roomId}`);
                if (result.isEmpty) {
                    console.log(`[ROOM CLEANUP] Cleaned up empty room: ${result.roomId}`);
                }
            }
        } catch (error) {
            console.error('Error handling disconnect cleanup:', error);
        }
    });
  });
}
