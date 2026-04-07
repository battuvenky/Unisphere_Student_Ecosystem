type RoomTarget = {
  emit: (event: string, payload?: unknown) => void;
};

type RealtimeServer = {
  emit: (event: string, payload?: unknown) => void;
  to: (room: string) => RoomTarget;
};

type GlobalWithRealtime = typeof globalThis & {
  __unisphere_io?: RealtimeServer;
};

function getRealtimeServer() {
  return (globalThis as GlobalWithRealtime).__unisphere_io;
}

export function emitRealtimeEvent(event: string, payload?: unknown) {
  const io = getRealtimeServer();
  if (!io) {
    return;
  }

  io.emit(event, payload);
}

export function emitRealtimeToRoom(room: string, event: string, payload?: unknown) {
  const io = getRealtimeServer();
  if (!io) {
    return;
  }

  io.to(room).emit(event, payload);
}
