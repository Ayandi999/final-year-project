// In-Memory Room Store Definitions
interface InMemRoom {
  hostId: string;
  createdAt: string;
  participants: Set<string>;
}

const inMemoryRooms = new Map<string, InMemRoom>();
const inMemoryUserRooms = new Map<string, string>(); // userId -> roomId
const inMemoryUserRoles = new Map<string, 'signer' | 'listener'>(); // userId -> role

export interface RoomData {
  hostId: string;
  createdAt: string;
}

export interface JoinRoomResult {
  success: boolean;
  message?: string;
  role?: 'signer' | 'listener';
}

/**
 * Creates a unique room ID and registers it in-memory.
 */
export async function createRoom(hostId: string, customRoomId?: string): Promise<string> {
  const roomId = customRoomId || crypto.randomUUID();

  inMemoryRooms.set(roomId, {
    hostId: hostId,
    createdAt: new Date().toISOString(),
    participants: new Set()
  });
  inMemoryUserRooms.set(hostId, roomId);
  console.log(`[ROOM-STORE] Room created: ${roomId} by host ${hostId}`);
  return roomId;
}

/**
 * Retrieves the room information.
 */
export async function getRoom(roomId: string): Promise<RoomData | null> {
  const room = inMemoryRooms.get(roomId);
  if (!room) return null;
  return {
    hostId: room.hostId,
    createdAt: room.createdAt
  };
}

/**
 * Gets the room ID currently associated with a host user.
 */
export async function getUserRoom(hostId: string): Promise<string | null> {
  return inMemoryUserRooms.get(hostId) || null;
}

/**
 * Adds a user to a room, enforcing a maximum of 2 participants and assigning roles.
 */
export async function joinRoom(
  roomId: string, 
  userId: string, 
  chosenRole?: 'signer' | 'listener'
): Promise<JoinRoomResult> {
  const room = inMemoryRooms.get(roomId);
  if (!room) {
    return { success: false, message: "Room not found or expired" };
  }

  if (room.participants.has(userId)) {
    const savedRole = inMemoryUserRoles.get(userId);
    return { success: true, role: savedRole || 'signer' };
  }

  if (room.participants.size >= 2) {
    return { success: false, message: "Room is full (maximum 2 participants allowed)" };
  }

  // Determine and validate chosen role
  let role: 'signer' | 'listener';
  if (chosenRole) {
    // Check if someone else has this role already in this room
    let roleTaken = false;
    for (const participantId of room.participants) {
      if (inMemoryUserRoles.get(participantId) === chosenRole) {
        roleTaken = true;
        break;
      }
    }
    if (roleTaken) {
      return { success: false, message: `Role '${chosenRole}' is already taken in this room.` };
    }
    role = chosenRole;
  } else {
    // Order fallback: first user signer, second user listener
    role = room.participants.size === 0 ? 'signer' : 'listener';
  }

  room.participants.add(userId);
  inMemoryUserRooms.set(userId, roomId);
  inMemoryUserRoles.set(userId, role);
  console.log(`[ROOM-STORE] User ${userId} joined room ${roomId} as ${role}`);
  return { success: true, role };
}

/**
 * Returns participants of a room.
 */
export async function getRoomParticipants(roomId: string): Promise<string[]> {
  const room = inMemoryRooms.get(roomId);
  return room ? Array.from(room.participants) : [];
}

/**
 * Removes a user from their active room.
 */
export async function leaveRoom(userId: string): Promise<{ roomId: string | null; isEmpty: boolean }> {
  const roomId = inMemoryUserRooms.get(userId);
  if (!roomId) {
    return { roomId: null, isEmpty: false };
  }

  inMemoryUserRooms.delete(userId);
  inMemoryUserRoles.delete(userId);
  const room = inMemoryRooms.get(roomId);
  if (!room) {
    return { roomId, isEmpty: true };
  }

  room.participants.delete(userId);
  const isEmpty = room.participants.size === 0;
  if (isEmpty) {
    inMemoryRooms.delete(roomId);
    console.log(`[ROOM-STORE] Room ${roomId} cleaned up (empty)`);
  }

  return { roomId, isEmpty };
}
