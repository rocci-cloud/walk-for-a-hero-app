Pod::Spec.new do |s|
  s.name           = 'WfahBackgroundActivity'
  s.version        = '1.0.0'
  s.summary        = 'Holds an iOS CLBackgroundActivitySession while a walk is recording'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Walk For A Hero Foundation'
  s.homepage       = 'https://walkforahero.com'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreLocation'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
