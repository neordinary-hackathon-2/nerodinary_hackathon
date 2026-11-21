interface ChannelGuideItem {
  number: number;
  name: string;
}

interface ChannelGuideProps {
  channels: ChannelGuideItem[];
}

const ChannelGuide = ({channels}: ChannelGuideProps) => {
  return (
    <section className="flex h-[488px] w-[322px] shrink-0 flex-col items-center justify-center gap-[18px] bg-[url(/channel-guide/frame.svg)] bg-no-repeat px-6 py-8">
      <h2 className="w-full text-center text-[20px] leading-[1.2] font-bold text-text-muted">
        밥송국 채널 편성표
      </h2>
      <div className="w-full">
        <div className="flex h-7 items-center border-b-2 border-brown-500 px-4 text-[12px] leading-normal font-semibold text-olive-500">
          <span className="w-[88px]">채널</span>
          <span>카테고리</span>
        </div>
        <ul>
          {channels.map((channel) => (
            <li
              key={channel.number}
              className="flex h-8 items-center border-b border-border-subtle px-4 leading-normal last:border-b-0"
            >
              <span className="w-[88px] font-silkscreen text-[12px] font-bold text-text-muted">
                CH {channel.number}
              </span>
              <span className="text-[14px] font-semibold text-text-soft">
                {channel.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="w-full text-center text-[12px] leading-[1.2] font-semibold text-olive-500">
        채널 키 또는 숫자 키(0~9)로 이동할 수 있어요.
      </p>
    </section>
  );
};

export default ChannelGuide;
