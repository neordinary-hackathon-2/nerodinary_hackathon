interface ChannelGuideItem {
  number: number;
  name: string;
}

interface ChannelGuideProps {
  channels: ChannelGuideItem[];
}

const ChannelGuide = ({channels}: ChannelGuideProps) => {
  return (
    <section className="relative h-[488px] w-[322px] shrink-0 bg-[url(/channel-guide/frame.svg)] bg-no-repeat text-text-muted">
      <h2 className="absolute inset-x-[25px] top-[21px] text-center text-[20px] leading-normal font-bold">
        밥송국 채널 편성표
      </h2>
      <div className="absolute top-[62px] left-[25px] flex w-[272px] text-[13px] leading-normal font-semibold text-olive-500">
        <span className="w-[60px]">채널</span>
        <span>카테고리</span>
      </div>
      <div className="absolute top-[84px] left-[25px] h-px w-[272px] bg-brown-500" />
      <ul className="absolute top-[85px] left-[25px] w-[272px] text-[13px] leading-normal">
        {channels.map((channel) => (
          <li
            key={channel.number}
            className="flex h-[35px] border-b border-border-subtle pt-[9px] last:border-b-0"
          >
            <span className="w-[60px] font-bold">CH {channel.number}</span>
            <span className="font-medium">{channel.name}</span>
          </li>
        ))}
      </ul>
      <p className="absolute top-[442px] left-[25px] text-[12px] leading-[1.3] font-semibold whitespace-nowrap text-text-hint">
        채널 키 또는 숫자 키(0~9)로 이동할 수 있어요.
      </p>
    </section>
  );
};

export default ChannelGuide;
