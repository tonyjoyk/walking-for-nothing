# Audio: project brief and source research

**Method:** BMAD: this brief (analyst) → `prd.md` → `architecture.md` → Epic 6 (`docs/epics/epic-6-audio.md`) and stories `docs/stories/6.x`.
**Date:** 20 Oct 2026. **Status:** for review.

## The problem

Today all sound is generated in code: filtered noise for wind and rain, and
sine "chirps" for birds. It's clean and costs nothing, but it doesn't sound
like Kerala, or like any real place. There are no dawn birds, no evening
crickets, no monsoon frogs and no thunder.

The scenes change visually through dawn, day, wind, rain, sunset and night,
but the sound barely changes.

## The goal

Make each scene sound like the same field in Pala at that moment:
- calm;
- authentic;
- recorded in Kerala or South India where possible;
- with occasional thunder giving the rain some character.

Sound stays opt-in, and the visuals must still stand on their own.

## Constraints that shape every choice

1. **The site and repo are public.** Any audio file we ship can be
   downloaded, which counts as redistributing it. Many "royalty-free"
   libraries forbid exactly that. Only openly licensed recordings work:
   CC0, CC BY, CC BY-SA, and CC BY-NC while the site stays non-commercial.
2. **Credit is required** for CC BY, BY-SA and BY-NC: title, recordist,
   link and licence. The README has a credits section, and the page needs
   a small credits link.
3. **ShareAlike** (xeno-canto CC BY-SA): any trimmed or looped file built
   from it must itself be released as CC BY-SA. This covers the audio file
   only, not the code.
4. **NoDerivatives** recordings can't be trimmed or looped, so they're out.
   That includes many xeno-canto uploads.
5. **Small and lazy.** Audio loads only after the visitor turns sound on.
   Total size stays under about 6 MB, and each scene is fetched when first
   needed.
6. **Browsers:** iOS needs a tap to start audio. Opus plays in modern
   browsers, and AAC is the fallback for older Safari. MP3 leaves gaps at
   loop points.

## Library verdicts

| Source | Use? | Why |
| --- | --- | --- |
| **Freesound** CC0 / CC BY | **Yes** | Redistribution allowed; credit needed for BY. Check each description for extra requests (one recordist, klankbeeld, asks for no raw redistribution, so skip his files). |
| **Freesound** CC BY-NC | **Yes, if the site stays non-commercial** | Most authentic Kerala recordings are under this. Ads or sponsorship would break it. |
| **xeno-canto** CC0 / CC BY-SA | **Yes** (BY-SA files ship as BY-SA) | Best Kerala bird calls (Jairam Vijayan, Sathyan Meppayur). Licences were read from GBIF's mirror; check each on xeno-canto.org. |
| xeno-canto CC BY-NC-ND | No | Can't be trimmed or looped. |
| BBC Sound Effects | No | Personal, educational and research use only. |
| Sonniss GDC bundle | No | Forbids distributing the sounds themselves. |
| Pixabay | No | Forbids distributing standalone files. |
| Zapsplat (free tier) | No | Forbids standalone redistribution. |
| Macaulay Library | No | Request-only downloads; the contributor keeps copyright. |
| "Ambiences from Suburban India" (A Sound Effect) | No | Its licence forbids sound-focused products and passing files on (clauses 3 and 8). |

## Shortlist by layer

Licences were confirmed on each recording's page. Nobody has listened to
them yet: Story 6.1 is a listening pass to make the final picks.

### Dawn
- **Bed:** "Tropical Orchard in Spring", Calcuttan,
  [Freesound 184798](https://freesound.org/people/Calcuttan/sounds/184798/),
  **CC BY 4.0**, 2:40, 96 kHz. Koel, coppersmith barbet, myna, magpie
  robin and kingfisher: the right species, though recorded near Kolkata.
- **Kerala layer:** "Asian Koels", genghisattenborough,
  [Freesound 27492](https://freesound.org/people/genghisattenborough/sounds/27492/),
  Trivandrum dawn, **CC BY-NC 4.0**, 1:34.
- **Alternative:** "Dawn chorus in North Goa",
  [Freesound 787307](https://freesound.org/people/HotCatMedia/sounds/787307/),
  **CC0**, 1:30.

### Daylight
- **Bed:** "crickets and tropical birds… India", kyles,
  [Freesound 451945](https://freesound.org/people/kyles/sounds/451945/),
  **CC0**, 2:35, 48 kHz FLAC.
- **Kerala layer:** "Farmlife", Manu593,
  [Freesound 808117](https://freesound.org/people/Manu593/sounds/808117/).
  An open paddy field in **Kottayam**, 4:40, **CC BY-NC 4.0**, with
  coucals, insects and frogs. Distant vehicles need trimming.
- **Quiet extra:** Chalakudy River, Kerala,
  [Freesound 332419](https://freesound.org/people/seventhsamurai/sounds/332419/),
  **CC0**. Phone quality, so use it very low or not at all.

### Wind
- **Bed:** "Wind through the palm trees… (Gran Sabana)", felix.blume,
  [Freesound 384550](https://freesound.org/people/felix.blume/sounds/384550/),
  **CC0**, 3:24, 48 kHz mid-side. Wind in palms.
- **Grass layer:** "Wind in the African bush", felix.blume,
  [Freesound 171445](https://freesound.org/people/felix.blume/sounds/171445/),
  **CC0**, 1:48.
- **Alternative:** "Wind in dry tall grass", felix.blume,
  [Freesound 666175](https://freesound.org/people/felix.blume/sounds/666175/),
  **CC0**, 5:01. Cut around the moments of wind hitting the mic.

### Rain
- **Steady:** "Light rain in a field of bananas trees", felix.blume,
  [Freesound 512334](https://freesound.org/people/felix.blume/sounds/512334/),
  **CC0**, 10:00, 96 kHz.
- **Heavy monsoon:** "Tropical rain Thailand 02", LG,
  [Freesound 462774](https://freesound.org/people/LG/sounds/462774/),
  **CC BY 4.0**, 5:04. May contain some thunder.
- **Easing off:** "End of the rainstorm Thailand", LG,
  [Freesound 462776](https://freesound.org/people/LG/sounds/462776/),
  **CC BY 4.0**, 3:57. Suits the move from rain into the next scene.

### Thunder
All from TRP, all **CC0**. We cut 4–8 separate rolls from these.
- [578230](https://freesound.org/people/TRP/sounds/578230/): 14:54 of dry,
  distant rolls.
- [616607](https://freesound.org/people/TRP/sounds/616607/): very distant
  and dispersed.
- [574386](https://freesound.org/people/TRP/sounds/574386/): a closer but
  gentle roll.
- [568969](https://freesound.org/people/TRP/sounds/568969/): low rolls.

### Sunset
- **Kerala bed:** "Odayam sounds (nice)", genghisattenborough,
  [Freesound 28263](https://freesound.org/people/genghisattenborough/sounds/28263/),
  Varkala evening, **CC BY-NC 4.0**, 1:48. House crows, with crickets
  starting.
- **Transition:** "Birds to Crickets", deadmanswill,
  [Freesound 568216](https://freesound.org/people/deadmanswill/sounds/568216/),
  Nilgiris, **CC BY 4.0**, 3:09, mono.
- **Also fits:** "Farmlife" (808117, above) was recorded at day's end.

### Night
- **Bed:** "Paddy frogs chorus", genghisattenborough,
  [Freesound 31948](https://freesound.org/people/genghisattenborough/sounds/31948/),
  a paddy at Odayam, Kerala, **CC BY-NC 4.0**, 3:56. Frogs and crickets.
- **Kerala layer:** "Odayam sounds (night time)",
  [Freesound 28264](https://freesound.org/people/genghisattenborough/sounds/28264/),
  **CC BY-NC 4.0**, 5:32. Owlets, frogs and fruit bats. **Contains distant
  temple music, so trim it out** (see cultural note).
- **Clean-licence alternative:** "Night Crickets on a Quiet Road – Goa",
  [Freesound 803557](https://freesound.org/people/Federico_Casazza/sounds/803557/),
  **CC BY 4.0**.

### Bird one-shots (events and passing flocks)

| Bird | Recording | Licence |
| --- | --- | --- |
| Asian koel | xeno-canto XC753727 (Jairam Vijayan, Kannur); [Freesound 460466](https://freesound.org/people/ramblinglibrarian/sounds/460466/) | BY-SA; CC0 |
| Rose-ringed parakeets (passing flocks) | [Freesound 845740](https://freesound.org/people/TheKingOfGeeks360/sounds/845740/) | CC0 |
| Common myna (flock) | [Freesound 338173](https://freesound.org/people/edranil/sounds/338173/) | CC0 |
| House crows (evening) | [Freesound 249567](https://freesound.org/people/Calcuttan/sounds/249567/) | CC0 |
| White-throated kingfisher | xeno-canto XC603361 (Sathyan Meppayur, Kozhikode) | CC0 |
| Coppersmith barbet | xeno-canto XC879002 (Jairam Vijayan) | BY-SA |
| Red-whiskered bulbul | xeno-canto XC738293 (Jairam Vijayan) | BY-SA |
| Greater coucal | xeno-canto XC676987 (Manoj Karingamadathil, Kannur) | BY-SA |
| Jungle owlet (night) | xeno-canto XC1043296 (Jairam Vijayan, Payyavoor) | BY-SA |
| Indian nightjar (night) | xeno-canto XC758305 (Jairam Vijayan) | BY-SA |

Egrets rarely call. A near-silent egret flock with the odd croak is
authentic; parakeets and mynas carry the passing-flock sound.

## Cultural note

Pala is largely Syro-Malabar Christian. The best Kerala night recording
(28264) includes distant temple music. The default is **no religious
sound** (no temple music, azaan or bells), because ritual practice isn't
background texture.

A distant church bell at sunset would be authentic to Pala. It's left as
your call (PRD open question 3).

## Recommendation

Use the **Kerala-authentic set**: Farmlife, Odayam night, paddy frogs, the
Trivandrum koels and the Kerala xeno-canto calls. Fill gaps with CC0 and
CC BY recordings.

This includes CC BY-NC files, so the site must stay non-commercial. If you
want the option to monetise later, the **open-only set** (CC0, BY and BY-SA
only) is listed above as the alternative for each layer, and the pipeline
can swap between them in the manifest.
