import { registerPlugin } from "@capacitor/core"

const AppleMusicPlaybackPlugin = registerPlugin("AppleMusicPlaybackPlugin")

export default {
  getNowPlaying: () => AppleMusicPlaybackPlugin.getNowPlaying(),
  play: () => AppleMusicPlaybackPlugin.play(),
  pause: () => AppleMusicPlaybackPlugin.pause(),
  next: () => AppleMusicPlaybackPlugin.next(),
  previous: () => AppleMusicPlaybackPlugin.previous(),
  setQueueAndPlay: (options) => AppleMusicPlaybackPlugin.setQueueAndPlay(options),
  setQueueOnly: (options) => AppleMusicPlaybackPlugin.setQueueOnly(options),
  changeToIndex: (options) => AppleMusicPlaybackPlugin.changeToIndex(options),
}