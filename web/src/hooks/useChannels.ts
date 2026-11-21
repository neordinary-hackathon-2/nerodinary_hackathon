import {useQuery} from '@tanstack/react-query';

import API from '@/api';
import {queryKeys} from '@/constants/queryKeys';

/** 채널 편성표(번호·이름·슬로건). 편성표를 처음 열 때(enabled) 불러온다. */
const useChannels = (enabled: boolean) => {
  const {data, isPending, isError} = useQuery({
    queryKey: queryKeys.channels,
    queryFn: () => API.channels.getChannels(),
    enabled,
    staleTime: Infinity,
  });

  return {channels: data?.channels, isPending, isError};
};

export default useChannels;
