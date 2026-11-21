package expo.modules.systemvolume

import android.content.Context
import android.media.AudioManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SystemVolumeModule : Module() {
  private val audioManager: AudioManager
    get() = (appContext.reactContext ?: throw Exceptions.ReactContextLost())
      .getSystemService(Context.AUDIO_SERVICE) as AudioManager

  override fun definition() = ModuleDefinition {
    Name("SystemVolume")

    // 미디어(STREAM_MUSIC) 볼륨을 기기의 한 칸만큼 움직인다. WebView 영상 소리가 이 스트림으로 난다.
    Function("adjust") { direction: String ->
      val adjustment = if (direction == "up") AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER
      audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, adjustment, AudioManager.FLAG_SHOW_UI)
    }
  }
}
