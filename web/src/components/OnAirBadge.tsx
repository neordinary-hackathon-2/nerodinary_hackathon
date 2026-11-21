interface OnAirBadgeProps {
  isLive: boolean;
}

const OnAirBadge = ({isLive}: OnAirBadgeProps) => {
  return (
    <div className="flex min-w-[76px] items-center justify-center gap-[5px] border-2 border-border-strong bg-bg-surface px-2 py-[5px] shadow-hard">
      <span
        className={`size-1 ${isLive ? 'bg-status-on-air' : 'bg-text-muted'}`}
        aria-hidden
      />
      <span className="font-silkscreen text-[9px] leading-[1.2] font-bold tracking-[0.36px] whitespace-nowrap text-text-muted">
        {isLive ? 'ON AIR' : 'OFF AIR'}
      </span>
    </div>
  );
};

export default OnAirBadge;
