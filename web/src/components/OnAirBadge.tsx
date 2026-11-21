interface OnAirBadgeProps {
  isLive: boolean;
}

const OnAirBadge = ({isLive}: OnAirBadgeProps) => {
  return (
    <div
      className={`flex items-center gap-[5px] border-2 border-border-strong px-2 py-[5px] shadow-hard ${isLive ? 'bg-bg-accent text-text-primary' : 'bg-bg-surface text-text-muted'}`}
    >
      <span className="size-1 bg-current" aria-hidden />
      <span className="font-silkscreen text-[9px] leading-[1.2] font-bold tracking-[0.36px] whitespace-nowrap">
        {isLive ? 'ON AIR' : 'OFF AIR'}
      </span>
    </div>
  );
};

export default OnAirBadge;
