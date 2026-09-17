import axios from '../../Oblecto-Web/node_modules/axios/index.js'
import SessionClient from '../../Oblecto-Web/src/oblecto-client/src/SessionClient.js'
import PlaybackController, { browserCapabilities } from '../../Oblecto-Web/src/playback/PlaybackController.js'
const video = document.querySelector('video')
const client = new SessionClient({ axios: axios.create({ baseURL: location.origin, headers: { Authorization: `Bearer ${window.token}` } }) })
window.controller = new PlaybackController(client, state => {
  window.playbackState = { ...window.playbackState, ...state }
  document.querySelector('#error').textContent = window.playbackState.error || ''
})
window.start = async (quality = 'original', position = 0) => {
  const session = await window.controller.open(1, { capabilities: browserCapabilities(video), quality, position, subtitleMode: 'off' })
  if (session) window.controller.attach(video, true)
}
document.querySelector('#start').onclick = () => window.start()
document.querySelector('#stop').onclick = () => window.controller.stop()
window.ready = true
