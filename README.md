# Blockcraft

A Minecraft-like voxel game written in plain JavaScript and WebGL2, with no game engine and no build step.

**Play:** open `index.html` through any static web server (for example `python3 -m http.server`), or turn on GitHub Pages for this repo.

## Features
- Realistic world generation: continents, ridged mountains, winding rivers, beaches, swamps, and about 25 biomes
- Caves, ore veins, the Nether, redstone, mobs, survival and creative modes
- Over 1,250 blocks with vanilla models, including fences, walls and panes that connect, potted plants, slabs, buttons, rails, pistons and more
- Java- and Bedrock-style menus, skins, third-person view, and mod and resource-pack importing (any Java resource pack `.zip`)
- Keyboard and mouse, controller, and touch (on phones and tablets)

## Multiplayer
The host picks **Open to Friends** in the pause menu and gets a 6-letter code. Friends tap **Multiplayer** (or **Friends** on phones) on the title screen and enter it. Connections go browser-to-browser (WebRTC, matchmaking by the free PeerJS service), so both players need internet. Positions, skins, block changes, chat, time and mobs are shared; the host's browser keeps the world.

## Mods
Zip a mod's folder (for example `mods/minimap`) and import it from the Mods screen. Mods get an `api` object with events such as `tick`, `hud`, `join` and `blockBreak`.
- **Minimap:** a minimap in the top-right corner. Press M for the full world map and N to zoom.

## Controls
WASD to move, Space to jump, mouse to look, left click to break, right click to place, E for inventory, T for chat, F5 for third person.

## Assets and licenses
- Block, item and GUI textures are derived from [Faithful](https://faithfulpack.net) (see `FAITHFUL-LICENSE.txt`).
- Controller prompt icons are from [Kenney](https://kenney.nl) (CC0).
- The player's idle and walking animation comes from "Minecraft Idle and Walking animation" by [Osk1](https://sketchfab.com/Osk1) (CC-BY 4.0).
- The axolotl swim cycle and the bee wing beat are sampled from "Minecraft Axolotl" and "Minecraft Bee" by [None_Yaroslav](https://sketchfab.com/None_Yaroslav) (CC-BY 4.0).
- The ghast, slime, snow golem and wolf models are by [Vincent Yanez](https://sketchfab.com/vinceyanez), the phantom by [trmhtk2](https://sketchfab.com/trmhtk2) the tadpole and frog by [RilyGames](https://sketchfab.com/RilyGame), the fox by [kuzneciv](https://sketchfab.com/kuzneciv), the sniffer by [Minecraft_Master](https://sketchfab.com/porterjett13), the animated wither by [CanYuTsai](https://sketchfab.com/canyutsai1) and the arrow by [None_Yaroslav](https://sketchfab.com/None_Yaroslav), all CC-BY 4.0 on Sketchfab.
- Newer mob shapes are converted from Mojang's public bedrock-samples geometry; their textures are from Faithful.
- Mojang textures and sounds are **not** included. For sound, load a Minecraft sound pack `.zip` under Options > Music & Sounds. You can also import a resource pack from the Resource Packs screen.
- `tools/` holds the Python scripts used to build the texture atlas and convert block models.

Blockcraft is a fan project. It is not affiliated with Mojang or Microsoft.

## Credits
Horse, villager and witch model geometry is based on "Minecraft - Horse", "Minecraft - Villager" and "Minecraft - Witch" by Vincent Yanez (https://sketchfab.com/vinceyanez), licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
Pillager, vindicator and evoker references by None_Yaroslav (https://sketchfab.com/None_Yaroslav), zombie villager reference by Vincent Yanez, CC-BY-4.0.

## Sounds
The GitHub version has no sound files (they belong to Mojang). Press **Load Sounds** on the title screen and pick `Blockcraft Sounds.zip` once; the game remembers it.
