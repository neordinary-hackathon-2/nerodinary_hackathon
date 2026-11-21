import AVFoundation
import ExpoModulesCore
import MediaPlayer

// iOS 하드웨어 볼륨 버튼 한 번은 1/16만큼 움직인다.
private let volumeSteps: Float = 16

public class SystemVolumeModule: Module {
  // iOS는 시스템 볼륨을 바꾸는 공개 API가 없어 MPVolumeView 안의 슬라이더 값을 바꾼다.
  // 화면에 붙이지 않은 MPVolumeView를 쓰므로 시스템 볼륨 UI가 그대로 뜬다.
  private lazy var volumeView = MPVolumeView(frame: .zero)

  public func definition() -> ModuleDefinition {
    Name("SystemVolume")

    Function("adjust") { (direction: String) in
      let delta: Float = direction == "up" ? 1 : -1
      let current = AVAudioSession.sharedInstance().outputVolume
      let target = min(volumeSteps, max(0, (current * volumeSteps).rounded() + delta)) / volumeSteps
      let slider = self.volumeView.subviews.compactMap { $0 as? UISlider }.first
      slider?.setValue(target, animated: false)
    }.runOnQueue(.main)
  }
}
