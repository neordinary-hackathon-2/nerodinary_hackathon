import type {RandomVideosResultDto} from '@shared';

import {request} from './client';

export default {
  getRandomVideos() {
    return request<RandomVideosResultDto>('/channels/random-videos');
  },
};
