// zone_kol_music_client.js (startup, CLIENT only; Claude 11/25 for Ward)
// The server starts the Kollektor / Vodyanoy music with /playsound, which always makes a sound at a fixed spot.
// Sound Physics Remastered then treats it like any positional sound (mono downmix + occlusion), so the ambient faded
// out once you walked ~16 blocks from where it started and only came back when it looped. Here every one of those
// two tracks is swapped, as it starts, for a non-positional sound attached to the listener (like vanilla music):
// no distance fade, no sound physics, stereo kept. Same id + category, so the server's stopsound/loop still work.
// Startup script = only loads when the game starts.
try {
  const SimpleSoundInstance = Java.loadClass('net.minecraft.client.resources.sounds.SimpleSoundInstance')
  const Attenuation = Java.loadClass('net.minecraft.client.resources.sounds.SoundInstance$Attenuation')
  const SoundSource = Java.loadClass('net.minecraft.sounds.SoundSource')
  const RandomSource = Java.loadClass('net.minecraft.util.RandomSource')
  const ZKMC_IDS = { 'scavenger:music.kollektor': true, 'scavenger:music.vodyanoy': true }

  ForgeEvents.onEvent('net.minecraftforge.client.event.sound.PlaySoundEvent', event => {
    try {
      let s = event.getSound()
      if (!s || s.isRelative()) return
      if (!ZKMC_IDS[String(s.getLocation())]) return
      event.setSound(new SimpleSoundInstance(s.getLocation(), SoundSource.RECORDS, 1.0, 1.0, RandomSource.create(),
        false, 0, Attenuation.NONE, 0.0, 0.0, 0.0, true))
    } catch (e) {
      console.error('[zone] kol music client: ' + e)
    }
  })
  console.info('[zone] kol music client: music plays non-positional')
} catch (e) {
  console.info('[zone] kol music client not active here: ' + e)
}
