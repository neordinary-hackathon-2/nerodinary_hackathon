import {useQuery} from '@tanstack/react-query';

import API from '@/api';
import {queryKeys} from '@/constants/queryKeys';
import {COLOR_BAR_CHANNEL, COLOR_BAR_CHANNEL_NUMBER} from '@/constants/tv';

/**
 * 채널 편성표(번호·이름·슬로건). 편성표를 처음 열 때(enabled) 불러온다.
 * 서버 응답에 없는 0번 컬러바는 맨 앞에 붙인다.
 */
const useChannels = (enabled: boolean) => {
  const {data, isPending, isError} = useQuery({
    queryKey: queryKeys.channels,
    queryFn: () => API.channels.getChannels(),
    enabled,
    staleTime: Infinity,
    select: ({channels}) =>
      channels.some((item) => item.channelNumber === COLOR_BAR_CHANNEL_NUMBER)
        ? channels
        : [COLOR_BAR_CHANNEL, ...channels],
  });

  return {channels: data, isPending, isError};
};

export default useChannels;
