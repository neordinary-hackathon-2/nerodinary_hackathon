import type {ChannelListResultDto, RandomVideosResultDto} from '@shared';

import {request} from './client';

export default {
  getChannels() {
    return request<ChannelListResultDto>('/channels');
  },
  getRandomVideos() {
    return request<RandomVideosResultDto>('/channels/random-videos');
  },
};
