import {useQuery} from '@tanstack/react-query';

import API from '@/api';
import {queryKeys} from '@/constants/queryKeys';
import {COLOR_BAR_CHANNEL_NUMBER} from '@/constants/tv';

/**
 * 전체 채널과 채널별 랜덤 영상. TV를 켤 때(enabled) 처음 불러온다.
 * 채널별 영상은 접속 동안 고정이라 다시 불러오지 않는다(staleTime: Infinity).
 * 서버 응답에 없는 0번 컬러바를 영상 없는 채널로 붙여, 숫자 키 0으로 들어갈 수 있게 한다.
 */
const useRandomVideos = (enabled: boolean) => {
  const {data, isPending, isError, refetch} = useQuery({
    queryKey: queryKeys.randomVideos,
    queryFn: () => API.channels.getRandomVideos(),
    enabled,
    staleTime: Infinity,
    // 채널이 하나도 없으면(방송 준비 중) 0번도 붙이지 않아 빈 상태 처리를 그대로 둔다.
    select: ({channels}) =>
      channels.length === 0 ||
      channels.some((item) => item.channelNumber === COLOR_BAR_CHANNEL_NUMBER)
        ? channels
        : [{channelNumber: COLOR_BAR_CHANNEL_NUMBER, videos: []}, ...channels],
  });

  return {channels: data, isPending, isError, refetch};
};

export default useRandomVideos;
