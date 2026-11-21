interface OnAirBadgeProps {
  isLive: boolean;
}

const OnAirBadge = ({isLive}: OnAirBadgeProps) => {
  return (
    <div
      className={`flex items-center gap-[5px] border-2 border-border-strong px-2 py-[5px] shadow-hard lg:gap-2.5 lg:border-4 lg:px-4 lg:py-2.5 lg:shadow-hard-lg ${isLive ? 'bg-bg-accent text-text-primary' : 'bg-bg-surface text-text-muted'}`}
    >
      <span className="size-1 bg-current lg:size-2" aria-hidden />
      <span className="font-silkscreen text-[9px] leading-[1.2] font-bold tracking-[0.36px] whitespace-nowrap lg:text-[18px] lg:tracking-[0.72px]">
        {isLive ? 'ON AIR' : 'OFF AIR'}
      </span>
    </div>
  );
};

export default OnAirBadge;
