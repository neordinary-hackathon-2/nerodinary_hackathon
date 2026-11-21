import {useQuery} from '@tanstack/react-query';

import API from '@/api';
import {queryKeys} from '@/constants/queryKeys';

/**
 * 전체 채널과 채널별 랜덤 영상. TV를 켤 때(enabled) 처음 불러온다.
 * 채널별 영상은 접속 동안 고정이라 다시 불러오지 않는다(staleTime: Infinity).
 */
const useRandomVideos = (enabled: boolean) => {
  const {data, isPending, isError, refetch} = useQuery({
    queryKey: queryKeys.randomVideos,
    queryFn: () => API.channels.getRandomVideos(),
    enabled,
    staleTime: Infinity,
  });

  return {channels: data?.channels, isPending, isError, refetch};
};

export default useRandomVideos;
