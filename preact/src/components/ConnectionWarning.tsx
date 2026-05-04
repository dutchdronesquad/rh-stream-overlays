type ConnectionWarningProps = {
  className?: string;
  isConnected: boolean;
};

export function ConnectionWarning({
  className = "connection-warning",
  isConnected
}: ConnectionWarningProps) {
  if (isConnected) {
    return null;
  }

  return <p class={className}>RotorHazard connection pending</p>;
}
