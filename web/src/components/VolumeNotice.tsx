interface VolumeNoticeProps {
  onClose: () => void;
}

/** iOS 웹에서 리모컨 볼륨 버튼을 눌렀을 때 띄우는 안내 카드 (Figma 시안 화면 / Channel Guide 322x228). */
const VolumeNotice = ({onClose}: VolumeNoticeProps) => {
  return (
    <section
      aria-label="음량 안내"
      className="relative flex h-[228px] w-[322px] shrink-0 flex-col items-center justify-center gap-[18px] bg-[url(/volume-notice/frame.svg)] bg-no-repeat px-6 py-8 text-center"
    >
      <h2 className="w-full text-[20px] leading-normal font-bold text-text-muted">
        음량은 기기 버튼으로
        <br />
        조절해 주세요
      </h2>
      <p className="w-full text-[14px] leading-normal font-semibold text-text-soft">
        iOS 에서는 화면 속 음량 조절을 지원하지 않아요.
        <br />
        기기 음량 버튼으로 소리를 조절해 주세요.
      </p>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute top-[37px] left-[282px] size-4 bg-[url(/icons/close.svg)] bg-no-repeat"
      />
    </section>
  );
};

export default VolumeNotice;
