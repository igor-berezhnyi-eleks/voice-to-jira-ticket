import { describe, expect, it } from 'vitest';
import { durationMessage, maxAudioBytes, prepareAudioFile } from './audioFile';

function file(name: string, type = '', size = 4): File {
  return new File([new Uint8Array(size)], name, { type });
}

function prepared(result: ReturnType<typeof prepareAudioFile>) {
  if ('message' in result) {
    throw new Error(result.message);
  }
  return result;
}

describe('prepareAudioFile', () => {
  it.each([
    ['talk.wav', 'audio/wav'],
    ['talk.mp3', 'audio/mpeg'],
    ['talk.webm', 'audio/webm'],
    ['talk.ogg', 'audio/ogg'],
  ])('sends %s as %s', (name, type) => {
    const result = prepared(prepareAudioFile(file(name)));
    expect(result.blob.type).toBe(type);
    expect(result.fileName).toBe(name);
  });

  it('takes the type from the extension, not the browser, and ignores case', () => {
    expect(prepared(prepareAudioFile(file('Memo.WAV', 'audio/x-wav'))).blob.type).toBe('audio/wav');
    expect(prepared(prepareAudioFile(file('a.mp3', 'audio/mp3'))).blob.type).toBe('audio/mpeg');
    expect(prepared(prepareAudioFile(file('a.ogg', ''))).blob.type).toBe('audio/ogg');
  });

  it.each(['memo.m4a', 'memo.flac', 'notes.txt', 'noextension', 'recording.wav.exe'])('refuses %s', (name) => {
    expect(prepareAudioFile(file(name, 'audio/wav'))).toEqual({ message: expect.stringContaining('not supported') });
  });

  it('refuses an empty file and one over 25 MB, but not one of exactly 25 MB', () => {
    expect(prepareAudioFile(file('a.wav', '', 0))).toEqual({ message: 'That file is empty.' });
    expect(prepareAudioFile(file('a.wav', '', maxAudioBytes + 1))).toEqual({ message: expect.stringContaining('25 MB') });
    expect('message' in prepareAudioFile(file('a.wav', '', maxAudioBytes))).toBe(false);
  });
});

describe('durationMessage', () => {
  it('allows up to 5:00 and an unknown length', () => {
    expect(durationMessage(null)).toBeNull();
    expect(durationMessage(0)).toBeNull();
    expect(durationMessage(300)).toBeNull();
  });

  it('names the length of a file that is too long, rounded up', () => {
    expect(durationMessage(300.2)).toBe('That recording is 5:01 long. The limit is 5:00. Use a shorter file.');
    expect(durationMessage(367)).toBe('That recording is 6:07 long. The limit is 5:00. Use a shorter file.');
  });
});
