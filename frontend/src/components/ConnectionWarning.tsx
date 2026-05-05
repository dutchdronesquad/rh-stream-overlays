import type { ConnectionState } from "../core/raceStore";

type Props = {
  connection: ConnectionState;
};

export function ConnectionWarning({ connection }: Props) {
  if (connection.isConnected) return null;

  const reconnecting = connection.lastConnectedAt !== null;
  const message = reconnecting ? "Reconnecting…" : "Connecting…";

  return (
    <div class="socket-warning" role="status">
      {message}
    </div>
  );
}
