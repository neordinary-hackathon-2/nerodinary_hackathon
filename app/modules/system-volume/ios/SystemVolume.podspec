Pod::Spec.new do |s|
  s.name           = 'SystemVolume'
  s.version        = '1.0.0'
  s.summary        = '기기 미디어 볼륨 조절'
  s.description    = '밥송국 리모컨 볼륨 버튼으로 기기 미디어 볼륨을 한 단계씩 조절한다.'
  s.author         = 'neordinary-hackathon-2'
  s.homepage       = 'https://github.com/neordinary-hackathon-2/nerodinary_hackathon'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
