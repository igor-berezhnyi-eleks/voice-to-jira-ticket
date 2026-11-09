# Audio fixtures

Synthetic speech made with Windows speech synthesis by `scripts/generate-audio-fixtures.ps1` (16 kHz, mono, 16-bit WAV). They let the STT path be checked without a person speaking. A clean synthetic voice says little about real voices; those are tested by the human in T2.4.

| File | Sentence | Key words (all must appear in the transcript, case-insensitive) |
|---|---|---|
| `bug-login-crash.wav` | When I tap the login button on the iPhone app, it crashes immediately. This started after the latest update. I expected to see the home screen. | login, crashes, update, home screen |
| `feature-dark-mode.wav` | We need a dark mode option in the settings page. Users should be able to switch between light and dark themes, and the choice should be remembered on the next visit. | dark mode, settings, themes, remembered |

If you change a sentence, change it in the script and here, then regenerate and commit the WAV.
