# Nebu Sprite Sheets v1

This folder contains the first production pass for Nebu's complete performance library.

## Atlas contract

- Canvas: `1280 × 1280` transparent PNG
- Layout: `4 columns × 4 rows`
- Frames: `16`
- Frame size: `320 × 320`
- Playback order: left to right, then top to bottom
- CSS background-size when rendered at one-frame size: `400% 400%`
- Card prop: deliberately blank so the real pull result can be layered above it during implementation
- Character lock: midnight-blue Nebu, gold eyes and markings, turquoise-and-gold collar

Timing below is a starting point for implementation. Important anticipation, reveal, and final-pose frames should use per-frame holds rather than forcing every frame to have the same duration.

## Core rarity ceremonies

| Performance ID | File | Scene | Base FPS | Target duration |
| --- | --- | --- | ---: | ---: |
| `litter_bowl` | `nebu-litter-bowl-v1.webp` | Celestial Litter Bowl | 6 | 3.4 s |
| `balloon_incident` | `nebu-balloon-incident-v1.webp` | The Balloon Incident | 7 | 3.2 s |
| `golden_yarn` | `nebu-golden-yarn-v1.webp` | Golden Yarn Chase | 7 | 3.5 s |
| `bath_bird` | `nebu-bath-bird-v1.webp` | Bath Time Interrupted | 6 | 3.8 s |
| `sunbeam_vault` | `nebu-sunbeam-vault-v1.webp` | Sunbeam Vault | 6 | 4.2 s |
| `living_mural` | `nebu-living-mural-v1.webp` | The Living Mural | 6 | 4.5 s |
| `catnip_star` | `nebu-catnip-star-v1.webp` | The Catnip Star | 5 | 5.0 s |
| `solar_heist` | `nebu-solar-heist-v1.webp` | Solar Barque Heist | 5 | 5.4 s |
| `constellation_chooses` | `nebu-constellation-chooses-v1.webp` | The Constellation Chooses You | 5 | 5.8 s |

## Unlockable alternative performances

| Performance ID | File | Scene | Base FPS | Target duration |
| --- | --- | --- | ---: | ---: |
| `sand_sneeze` | `nebu-sand-sneeze-v1.webp` | The Sand Sneeze | 7 | 3.3 s |
| `box_destiny` | `nebu-box-destiny-v1.webp` | Box of Destiny | 7 | 3.6 s |
| `papyrus_mouse` | `nebu-papyrus-mouse-v1.webp` | The Papyrus Mouse | 8 | 3.4 s |
| `moon_moth` | `nebu-moon-moth-v1.webp` | The Moon Moth | 6 | 4.1 s |
| `temple_domino` | `nebu-temple-domino-v1.webp` | Temple Domino | 7 | 3.8 s |
| `balance_heart` | `nebu-balance-heart-v1.webp` | Balance of the Heart | 5 | 4.8 s |
| `papyrus_theatre` | `nebu-papyrus-theatre-v1.webp` | Papyrus Theatre | 6 | 4.4 s |
| `sky_mirror` | `nebu-sky-mirror-v1.webp` | The Sky Mirror | 6 | 4.6 s |
| `eclipse_thief` | `nebu-eclipse-thief-v1.webp` | Eclipse Thief | 6 | 4.7 s |
| `hall_eight` | `nebu-hall-eight-v1.webp` | Hall of Eight | 5 | 5.5 s |

## Implementation notes

1. Preload the selected atlas before starting a pull so the first frame never flashes late.
2. Render one `320 × 320` cell at a time; do not display the full atlas and scale it with overflow clipping.
3. Use nearest-neighbour sampling (`image-rendering: pixelated`) at integer display scales.
4. Pause briefly on the anticipation frame, the blank-card reveal, and the final Nebu pose.
5. Layer the user's actual pulled card over the blank golden card only after the reveal frame.
6. Keep reduced-motion support: use the reveal frame and final frame with a short crossfade instead of full playback.
7. Do not begin playback until audio and atlas assets are ready; audio cues should follow the visual impact frame.

