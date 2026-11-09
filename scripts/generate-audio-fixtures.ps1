# Generates the synthetic audio fixtures with Windows speech synthesis.
# Usage (Windows PowerShell 5.1 or PowerShell 7 on Windows):
#   powershell -File scripts/generate-audio-fixtures.ps1
# Output: tests/fixtures/audio/*.wav (16 kHz, mono, 16-bit). Keep the sentences in sync
# with tests/fixtures/audio/README.md.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$outDir = Join-Path $PSScriptRoot '..\tests\fixtures\audio'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outDir = (Resolve-Path $outDir).Path

$fixtures = [ordered]@{
    'bug-login-crash' = 'When I tap the login button on the iPhone app, it crashes immediately. This started after the latest update. I expected to see the home screen.'
    'feature-dark-mode' = 'We need a dark mode option in the settings page. Users should be able to switch between light and dark themes, and the choice should be remembered on the next visit.'
}

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

foreach ($name in $fixtures.Keys) {
    $path = Join-Path $outDir "$name.wav"
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        $synth.SetOutputToWaveFile($path, $format)
        $synth.Speak($fixtures[$name])
    }
    finally {
        $synth.Dispose()
    }
    Write-Output ("{0} ({1} KB)" -f $path, [math]::Round((Get-Item $path).Length / 1KB))
}
