import Redis from 'ioredis';

const VALKEY_URL = process.env.VALKEY_URL || 'redis://localhost:6379';

// Initialize Valkey client using ioredis
export const valkeyClient = new Redis(VALKEY_URL, {
  maxRetriesPerRequest: 1, // Fail fast to trigger in-memory fallback quickly
  connectTimeout: 2000,
});

let useInMemoryFallback = false;

valkeyClient.on('connect', () => {
  console.log('Connected to Valkey successfully.');
  useInMemoryFallback = false;
});

valkeyClient.on('error', (err: any) => {
  console.warn('[VALKEY OFFLINE] Valkey connection error. Falling back to in-memory store:', err.message);
  useInMemoryFallback = true;
});

// In-Memory Fallback Store Definitions
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
 * Creates a unique room ID, registers it in Valkey, and sets it to expire.
 * Also maps the host user to their room ID.
 * @param hostId The user/socket ID of the room creator
 * @param customRoomId Optional custom room ID, otherwise randomUUID is used
 * @returns The generated/registered room ID
 */
export async function createRoom(hostId: string, customRoomId?: string): Promise<string> {
  const roomId = customRoomId || crypto.randomUUID();

  if (useInMemoryFallback) {
    inMemoryRooms.set(roomId, {
      hostId: hostId,
      createdAt: new Date().toISOString(),
      participants: new Set()
    });
    inMemoryUserRooms.set(hostId, roomId);
    console.log(`[IN-MEMORY] Room created: ${roomId} by host ${hostId}`);
    return roomId;
  }

  try {
    const roomKey = `room:${roomId}`;
    
    // Store room details
    await valkeyClient.hset(roomKey, {
      hostId: hostId,
      createdAt: new Date().toISOString()
    });

    // Set 24h expiration on the room
    await valkeyClient.expire(roomKey, 86400);

    // Map the host user to this room ID
    await valkeyClient.set(`user:room:${hostId}`, roomId, 'EX', 86400);

    return roomId;
  } catch (error) {
    console.warn('[VALKEY FAIL] createRoom failed. Falling back to in-memory:', error);
    useInMemoryFallback = true;
    
    // Re-run as in-memory
    inMemoryRooms.set(roomId, {
      hostId: hostId,
      createdAt: new Date().toISOString(),
      participants: new Set()
    });
    inMemoryUserRooms.set(hostId, roomId);
    return roomId;
  }
}

/**
 * Retrieves the room information from Valkey or fallback.
 * @param roomId The room ID to look up
 */
export async function getRoom(roomId: string): Promise<RoomData | null> {
  if (useInMemoryFallback) {
    const room = inMemoryRooms.get(roomId);
    if (!room) return null;
    return {
      hostId: room.hostId,
      createdAt: room.createdAt
    };
  }

  try {
    const roomKey = `room:${roomId}`;
    const data = await valkeyClient.hgetall(roomKey);
    
    if (!data || !data.hostId || !data.createdAt) {
      return null;
    }
    
    return {
      hostId: data.hostId,
      createdAt: data.createdAt
    };
  } catch (error) {
    console.warn('[VALKEY FAIL] getRoom failed. Falling back to in-memory:', error);
    useInMemoryFallback = true;
    const room = inMemoryRooms.get(roomId);
    if (!room) return null;
    return {
      hostId: room.hostId,
      createdAt: room.createdAt
    };
  }
}

/**
 * Gets the room ID currently associated with a host user.
 * @param hostId The user/socket ID of the host
 */
export async function getUserRoom(hostId: string): Promise<string | null> {
  if (useInMemoryFallback) {
    return inMemoryUserRooms.get(hostId) || null;
  }

  try {
    return await valkeyClient.get(`user:room:${hostId}`);
  } catch (error) {
    console.warn('[VALKEY FAIL] getUserRoom failed. Falling back to in-memory:', error);
    useInMemoryFallback = true;
    return inMemoryUserRooms.get(hostId) || null;
  }
}

/**
 * Adds a user to a room, enforcing a maximum of 2 participants
 * and assigning roles (validates against role conflict).
 * @param roomId The room ID
 * @param userId The user/socket ID of the participant
 * @param chosenRole The role selected by the user
 */
export async function joinRoom(
  roomId: string, 
  userId: string, 
  chosenRole?: 'signer' | 'listener'
): Promise<JoinRoomResult> {
  if (useInMemoryFallback) {
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
    console.log(`[IN-MEMORY] User ${userId} joined room ${roomId} as ${role}`);
    return { success: true, role };
  }

  try {
    const roomKey = `room:${roomId}`;
    const exists = await valkeyClient.exists(roomKey);
    if (!exists) {
      return { success: false, message: "Room not found or expired" };
    }

    const participantKey = `room:${roomId}:participants`;
    const rolesKey = `room:${roomId}:roles`;
    
    // Check if user is already in the room
    const isMember = await valkeyClient.sismember(participantKey, userId);
    if (isMember) {
      const savedRole = await valkeyClient.hget(rolesKey, userId);
      return { success: true, role: (savedRole as 'signer' | 'listener') || 'signer' };
    }

    const participantsCount = await valkeyClient.scard(participantKey);
    if (participantsCount >= 2) {
      return { success: false, message: "Room is full (maximum 2 participants allowed)" };
    }

    // Determine and validate chosen role
    let role: 'signer' | 'listener';
    if (chosenRole) {
      const currentRoles = await valkeyClient.hgetall(rolesKey);
      const rolesTaken = Object.values(currentRoles);
      if (rolesTaken.includes(chosenRole)) {
        return { success: false, message: `Role '${chosenRole}' is already taken in this room.` };
      }
      role = chosenRole;
    } else {
      role = participantsCount === 0 ? 'signer' : 'listener';
    }

    // Add participant to the room set
    await valkeyClient.sadd(participantKey, userId);
    await valkeyClient.expire(participantKey, 86400);

    // Store their role in the room's roles hash map
    await valkeyClient.hset(rolesKey, userId, role);
    await valkeyClient.expire(rolesKey, 86400);

    // Keep track of user's active room mapping
    await valkeyClient.set(`user:room:${userId}`, roomId, 'EX', 86400);

    console.log(`[VALKEY] User ${userId} joined room ${roomId} as ${role}`);
    return { success: true, role };
  } catch (error) {
    console.warn('[VALKEY FAIL] joinRoom failed. Falling back to in-memory:', error);
    useInMemoryFallback = true;
    
    // Re-run as in-memory
    return joinRoom(roomId, userId, chosenRole);
  }
}

export async function getRoomParticipants(roomId: string): Promise<string[]> {
  if (useInMemoryFallback) {
    const room = inMemoryRooms.get(roomId);
    return room ? Array.from(room.participants) : [];
  }

  try {
    return await valkeyClient.smembers(`room:${roomId}:participants`);
  } catch (error) {
    console.warn('[VALKEY FAIL] getRoomParticipants failed. Falling back to in-memory:', error);
    useInMemoryFallback = true;
    const room = inMemoryRooms.get(roomId);
    return room ? Array.from(room.participants) : [];
  }
}

/**
 * Removes a user from their active room.
 * @param userId The user/socket ID of the participant leaving
 * @returns Object containing the roomId and whether the room is now empty
 */
export async function leaveRoom(userId: string): Promise<{ roomId: string | null; isEmpty: boolean }> {
  if (useInMemoryFallback) {
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
      console.log(`[IN-MEMORY] Room ${roomId} cleaned up (empty)`);
    }

    return { roomId, isEmpty };
  }

  try {
    const roomId = await valkeyClient.get(`user:room:${userId}`);
    if (!roomId) {
      return { roomId: null, isEmpty: false };
    }

    // Remove user's active room mapping
    await valkeyClient.del(`user:room:${userId}`);

    const participantKey = `room:${roomId}:participants`;
    const rolesKey = `room:${roomId}:roles`;

    // Remove participant from the room's set and roles map
    await valkeyClient.srem(participantKey, userId);
    await valkeyClient.hdel(rolesKey, userId);

    // Check if room is empty
    const participantsCount = await valkeyClient.scard(participantKey);
    const isEmpty = participantsCount === 0;

    if (isEmpty) {
      // Delete room details, participants set, and roles map
      await valkeyClient.del(`room:${roomId}`);
      await valkeyClient.del(participantKey);
      await valkeyClient.del(rolesKey);
    }

    return { roomId, isEmpty };
  } catch (error) {
    console.warn('[VALKEY FAIL] leaveRoom failed. Falling back to in-memory:', error);
    useInMemoryFallback = true;
    
    // Re-run as in-memory
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
    }
    return { roomId, isEmpty };
  }
}
