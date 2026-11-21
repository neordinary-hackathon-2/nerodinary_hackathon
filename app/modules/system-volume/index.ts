import {requireNativeModule} from 'expo';

import type {AppVolumeDirection} from '@shared';

interface SystemVolumeModule {
  adjust: (direction: AppVolumeDirection) => void;
}

const SystemVolume = requireNativeModule<SystemVolumeModule>('SystemVolume');

/** 기기 미디어 볼륨을 한 단계 올리거나 내리고, 시스템 볼륨 UI를 띄운다. */
export const adjustSystemVolume = (direction: AppVolumeDirection) => {
  SystemVolume.adjust(direction);
};
